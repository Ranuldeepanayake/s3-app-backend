const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

const mockQuery = jest.fn();
const mockOn = jest.fn();
const mockContainerCredentials = jest.fn();

jest.mock('fs', () => ({
  readFileSync: jest.fn(() => Buffer.from('rds-ca-bundle'))
}));

jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    query: mockQuery,
    on: mockOn,
    end: jest.fn().mockResolvedValue()
  }))
}));

jest.mock('@aws-sdk/rds-signer', () => ({
  Signer: jest.fn(() => ({ getAuthToken: jest.fn().mockResolvedValue('iam-token') }))
}));

jest.mock('@aws-sdk/credential-providers', () => ({
  fromHttp: jest.fn(() => mockContainerCredentials)
}));

jest.mock('../src/config/logger.js', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn()
}));

describe('PostgreSQL config', () => {
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.DB_HOST = 'database.example.com';
    process.env.DB_PORT = '5432';
    process.env.DB_USERNAME = 's3_app_user';
    process.env.DB_NAME = 's3-app';
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI = 'http://169.254.170.23/creds';
    process.env.DB_CA_CERT_PATH = '/mnt/rds-ca/global-bundle.pem';
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it('returns false instead of connecting when required configuration is missing', async () => {
    delete process.env.DB_HOST;
    const { isPostgresHealthy } = require('../src/config/postgres.js');

    await expect(isPostgresHealthy()).resolves.toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('uses a pooled query for its active healthcheck', async () => {
    const { Pool } = require('pg');
    const { Signer } = require('@aws-sdk/rds-signer');
    const { fromHttp } = require('@aws-sdk/credential-providers');
    const fs = require('fs');
    mockQuery.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    const { isPostgresHealthy } = require('../src/config/postgres.js');

    await expect(isPostgresHealthy()).resolves.toBe(true);
    expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
    expect(fs.readFileSync).toHaveBeenCalledWith('/mnt/rds-ca/global-bundle.pem');
    expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
      ssl: { ca: Buffer.from('rds-ca-bundle'), rejectUnauthorized: true }
    }));
    expect(fromHttp).toHaveBeenCalledTimes(1);
    expect(Signer).toHaveBeenCalledWith(expect.objectContaining({
      credentials: mockContainerCredentials
    }));
  });

  it('reports an unhealthy database when the health query fails', async () => {
    mockQuery.mockRejectedValue(new Error('connection refused'));
    const { isPostgresHealthy } = require('../src/config/postgres.js');

    await expect(isPostgresHealthy()).resolves.toBe(false);
  });

  it('logs only the database name for a successful startup connection', async () => {
    const logger = require('../src/config/logger.js');
    mockQuery.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    const { testPostgresConnection } = require('../src/config/postgres.js');

    await expect(testPostgresConnection({ retries: 1 })).resolves.toBe(true);

    expect(logger.info).toHaveBeenCalledWith(
      'POSTGRES',
      'RDS PostgreSQL connection successful',
      { database: 's3-app' }
    );
  });
});
