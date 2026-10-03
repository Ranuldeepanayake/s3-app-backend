const postgres = require('../config/postgres');
const logger = require('../config/logger');

// Synthetic, read-only work keeps the load test independent of application
// tables while exercising PostgreSQL CPU and temporary working memory.
const TRAFFIC_QUERY = `
  SELECT count(*) AS generated_rows,
         sum(length(md5(value::text))) AS checksum
  FROM generate_series(1, 50000) AS value
`;

const SCRATCH_QUERY = {
  create: `
    CREATE TEMP TABLE load_scratch ON COMMIT DROP AS
    SELECT
      value,
      md5(value::text) AS digest,
      substring(
        repeat(md5(value::text), ceil($2 / 32.0)::integer)
        FROM 1 FOR $2
      ) AS payload
    FROM generate_series(1, $1::integer) AS value
  `,
  index: 'CREATE INDEX load_scratch_digest_idx ON load_scratch (digest)',
  aggregate: `
    SELECT digest, count(*)
    FROM load_scratch
    GROUP BY digest
    ORDER BY count(*) DESC
  `
};

const LIMITS = {
  minIntervalMs: 100,
  maxIntervalMs: 3_600_000,
  minParallelQueries: 1,
  maxParallelQueries: 100,
  minScratchRows: 10_000,
  maxScratchRows: 250_000,
  minScratchBlobBytes: 256,
  maxScratchBlobBytes: 8_192,
  maxScratchParallelQueries: 4
};

let timer = null;
let state = {
  running: false,
  intervalMs: null,
  parallelQueries: null,
  startedAt: null,
  lastRunAt: null,
  totalRuns: 0,
  successfulQueries: 0,
  failedQueries: 0,
  lastError: null,
  inFlight: false
};

const validateConfiguration = ({ intervalMs, parallelQueries, workload = 'light', scratchRows, scratchBlobBytes }) => {
  const interval = Number(intervalMs);
  const parallel = Number(parallelQueries);

  if (!Number.isInteger(interval) || interval < LIMITS.minIntervalMs || interval > LIMITS.maxIntervalMs) {
    return `Interval must be a whole number between ${LIMITS.minIntervalMs} and ${LIMITS.maxIntervalMs} milliseconds.`;
  }

  if (!Number.isInteger(parallel) || parallel < LIMITS.minParallelQueries || parallel > LIMITS.maxParallelQueries) {
    return `Parallel queries must be a whole number between ${LIMITS.minParallelQueries} and ${LIMITS.maxParallelQueries}.`;
  }

  if (!['light', 'scratch'].includes(workload)) {
    return 'Workload must be either light or scratch.';
  }

  if (workload === 'scratch') {
    if (parallel > LIMITS.maxScratchParallelQueries) {
      return `Scratch workload parallel queries must not exceed ${LIMITS.maxScratchParallelQueries}.`;
    }

    const rows = Number(scratchRows);
    const blobBytes = Number(scratchBlobBytes);
    if (!Number.isInteger(rows) || rows < LIMITS.minScratchRows || rows > LIMITS.maxScratchRows) {
      return `Scratch rows must be a whole number between ${LIMITS.minScratchRows} and ${LIMITS.maxScratchRows}.`;
    }

    if (!Number.isInteger(blobBytes) || blobBytes < LIMITS.minScratchBlobBytes || blobBytes > LIMITS.maxScratchBlobBytes) {
      return `Scratch blob size must be a whole number between ${LIMITS.minScratchBlobBytes} and ${LIMITS.maxScratchBlobBytes} bytes.`;
    }
  }

  return null;
};

const runScratchTransaction = async ({ scratchRows, scratchBlobBytes }) => {
  const pool = postgres.getPool();
  if (!pool) {
    throw new Error('PostgreSQL configuration is incomplete.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(SCRATCH_QUERY.create, [scratchRows, scratchBlobBytes]);
    await client.query(SCRATCH_QUERY.index);
    await client.query('ANALYZE load_scratch');
    await client.query(SCRATCH_QUERY.aggregate);
    await client.query('ROLLBACK');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

const runQueries = async () => {
  if (!state.running || state.inFlight) {
    return;
  }

  const runState = state;
  runState.inFlight = true;
  runState.lastRunAt = new Date().toISOString();
  runState.totalRuns += 1;

  const queryWork = runState.workload === 'scratch'
    ? () => runScratchTransaction(runState)
    : () => postgres.query(TRAFFIC_QUERY);
  const results = await Promise.allSettled(
    Array.from({ length: runState.parallelQueries }, queryWork)
  );

  const failed = results.filter((result) => result.status === 'rejected');
  runState.successfulQueries += results.length - failed.length;
  runState.failedQueries += failed.length;
  runState.lastError = failed[0]?.reason?.message || null;
  runState.inFlight = false;

  if (failed.length > 0) {
    logger.warn('POSTGRES-TRAFFIC', 'One or more traffic queries failed', {
      failedQueries: failed.length,
      error: runState.lastError
    });
  }
};

const stop = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  state.running = false;
  state.inFlight = false;
  return getStatus();
};

const start = (configuration) => {
  const validationError = validateConfiguration(configuration);
  if (validationError) {
    const error = new Error(validationError);
    error.status = 400;
    throw error;
  }

  stop();
  state = {
    running: true,
    intervalMs: Number(configuration.intervalMs),
    parallelQueries: Number(configuration.parallelQueries),
    workload: configuration.workload || 'light',
    scratchRows: configuration.workload === 'scratch' ? Number(configuration.scratchRows) : null,
    scratchBlobBytes: configuration.workload === 'scratch' ? Number(configuration.scratchBlobBytes) : null,
    startedAt: new Date().toISOString(),
    lastRunAt: null,
    totalRuns: 0,
    successfulQueries: 0,
    failedQueries: 0,
    lastError: null,
    inFlight: false
  };

  timer = setInterval(runQueries, state.intervalMs);
  timer.unref?.();
  runQueries().catch((error) => {
    state.lastError = error.message;
    state.inFlight = false;
    logger.error('POSTGRES-TRAFFIC', 'Traffic run failed unexpectedly', error.message);
  });

  logger.info('POSTGRES-TRAFFIC', 'PostgreSQL test traffic started', {
    intervalMs: state.intervalMs,
    parallelQueries: state.parallelQueries,
    workload: state.workload,
    scratchRows: state.scratchRows,
    scratchBlobBytes: state.scratchBlobBytes
  });
  return getStatus();
};

const getStatus = () => ({ ...state });

module.exports = {
  start,
  stop,
  getStatus,
  limits: LIMITS
};
