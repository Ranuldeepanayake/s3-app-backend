const postgres = require('../config/postgres');
const logger = require('../config/logger');

// Synthetic, read-only work keeps the load test independent of application
// tables while exercising PostgreSQL CPU and temporary working memory.
const TRAFFIC_QUERY = `
  SELECT count(*) AS generated_rows,
         sum(length(md5(value::text))) AS checksum
  FROM generate_series(1, 50000) AS value
`;

const LIMITS = {
  minIntervalMs: 100,
  maxIntervalMs: 3_600_000,
  minParallelQueries: 1,
  maxParallelQueries: 100
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

const validateConfiguration = ({ intervalMs, parallelQueries }) => {
  const interval = Number(intervalMs);
  const parallel = Number(parallelQueries);

  if (!Number.isInteger(interval) || interval < LIMITS.minIntervalMs || interval > LIMITS.maxIntervalMs) {
    return `Interval must be a whole number between ${LIMITS.minIntervalMs} and ${LIMITS.maxIntervalMs} milliseconds.`;
  }

  if (!Number.isInteger(parallel) || parallel < LIMITS.minParallelQueries || parallel > LIMITS.maxParallelQueries) {
    return `Parallel queries must be a whole number between ${LIMITS.minParallelQueries} and ${LIMITS.maxParallelQueries}.`;
  }

  return null;
};

const runQueries = async () => {
  if (!state.running || state.inFlight) {
    return;
  }

  const runState = state;
  runState.inFlight = true;
  runState.lastRunAt = new Date().toISOString();
  runState.totalRuns += 1;

  const results = await Promise.allSettled(
    Array.from({ length: runState.parallelQueries }, () => postgres.query(TRAFFIC_QUERY))
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
    parallelQueries: state.parallelQueries
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
