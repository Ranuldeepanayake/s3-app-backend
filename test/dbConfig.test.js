const { describe, it, expect, afterEach } = require('@jest/globals');
const mongoose = require('mongoose');
const { isMongoHealthy, clearReconnectTimers } = require('../src/config/db.js');
const logger = require('../src/config/logger.js');

jest.mock('../src/config/logger.js', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn()
}));

describe('db config', () => {
  const originalState = mongoose.connection.readyState;
  const originalDb = mongoose.connection.db;

  afterEach(() => {
    clearReconnectTimers();
    mongoose.connection.readyState = originalState;
    mongoose.connection.db = originalDb;
    jest.clearAllMocks();
  });

  it('returns false when mongoose is not connected', async () => {
    mongoose.connection.readyState = 0;
    mongoose.connection.db = null;

    const result = await isMongoHealthy();
    expect(result).toBe(false);
  });

  it('returns true when ping succeeds', async () => {
    mongoose.connection.readyState = 1;
    mongoose.connection.db = {
      admin: () => ({ ping: jest.fn().mockResolvedValue({ ok: 1 }) })
    };

    const result = await isMongoHealthy();
    expect(result).toBe(true);
  });

  it('returns false and logs a warning when ping fails', async () => {
    mongoose.connection.readyState = 1;
    mongoose.connection.db = {
      admin: () => ({ ping: jest.fn().mockRejectedValue(new Error('No ping')) })
    };

    const result = await isMongoHealthy();
    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith('MONGO', 'MongoDB healthcheck failed', 'No ping');
  });
});
