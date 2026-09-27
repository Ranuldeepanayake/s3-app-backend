// PostgreSQL authentication database client. AWS SDK credentials are resolved
// from the default provider chain, which includes EKS Pod Identity.

const { Pool } = require('pg');
const { Signer } = require('@aws-sdk/rds-signer');
const logger = require('./logger');

let pool;
let poolConfigurationKey;

const getPostgresConfiguration = () => {
  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT || 5432);
  const user = process.env.DB_USERNAME;
  const database = process.env.DB_NAME;
  const region = process.env.AWS_REGION;

  if (!host || !user || !database || !region || !Number.isInteger(port) || port <= 0) {
    return null;
  }

  return { host, port, user, database, region };
};

const getPool = () => {
  const configuration = getPostgresConfiguration();
  if (!configuration) {
    return null;
  }

  const configurationKey = JSON.stringify(configuration);
  if (pool && poolConfigurationKey === configurationKey) {
    return pool;
  }

  if (pool) {
    pool.end().catch((error) => logger.warn('POSTGRES', 'Error closing replaced pool', error.message));
  }

  const signer = new Signer({
    hostname: configuration.host,
    port: configuration.port,
    username: configuration.user,
    region: configuration.region
  });

  pool = new Pool({
    host: configuration.host,
    port: configuration.port,
    database: configuration.database,
    user: configuration.user,
    // pg invokes this callback when it opens a client, so every new connection
    // receives a freshly signed RDS IAM token.
    password: () => signer.getAuthToken(),
    ssl: { rejectUnauthorized: true },
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000)
  });
  poolConfigurationKey = configurationKey;

  pool.on('error', (error) => {
    logger.error('POSTGRES', 'Unexpected idle client error', error.message);
  });

  return pool;
};

const isPostgresHealthy = async () => {
  const activePool = getPool();
  if (!activePool) {
    logger.error('POSTGRES', 'PostgreSQL configuration is incomplete.');
    return false;
  }

  try {
    await activePool.query('SELECT 1');
    return true;
  } catch (error) {
    logger.warn('POSTGRES', 'PostgreSQL healthcheck failed', error.message);
    return false;
  }
};

// Probe RDS at startup with bounded retries. The application still starts in a
// degraded state so Kubernetes can surface dependency failures through health.
const testPostgresConnection = async ({ retries = 3, delayMs = 2000 } = {}) => {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    logger.info('POSTGRES', `Attempt ${attempt}/${retries}: testing RDS PostgreSQL access...`);
    if (await isPostgresHealthy()) {
      logger.info('POSTGRES', 'RDS PostgreSQL connection successful.');
      return true;
    }

    if (attempt < retries) {
      logger.info('POSTGRES', `Retrying in ${delayMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  logger.error('POSTGRES', 'RDS PostgreSQL connection failed after all retries.');
  return false;
};

const query = async (text, values) => {
  const activePool = getPool();
  if (!activePool) {
    const error = new Error('PostgreSQL configuration is incomplete.');
    error.code = 'POSTGRES_NOT_CONFIGURED';
    throw error;
  }

  return activePool.query(text, values);
};

const closePostgresPool = async () => {
  if (pool) {
    await pool.end();
    pool = undefined;
    poolConfigurationKey = undefined;
  }
};

module.exports = {
  getPool,
  query,
  isPostgresHealthy,
  testPostgresConnection,
  closePostgresPool
};
