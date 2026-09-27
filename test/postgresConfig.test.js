const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

const mockQuery = jest.fn();
const mockOn = jest.fn();

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
    mockQuery.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    const { isPostgresHealthy } = require('../src/config/postgres.js');

    await expect(isPostgresHealthy()).resolves.toBe(true);
    expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
  });

  it('reports an unhealthy database when the health query fails', async () => {
    mockQuery.mockRejectedValue(new Error('connection refused'));
    const { isPostgresHealthy } = require('../src/config/postgres.js');

    await expect(isPostgresHealthy()).resolves.toBe(false);
  });
});
