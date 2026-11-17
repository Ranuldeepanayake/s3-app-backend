// Verifies structured logger records and centralized credential redaction.
const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const logger = require('../src/config/logger.js');

describe('logger', () => {
  let infoSpy;
  let warnSpy;
  let errorSpy;

  beforeEach(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('writes a timestamped record with stable service and component context', () => {
    logger.info('TEST', 'Info message', { requestId: 'request-1' });

    const record = JSON.parse(infoSpy.mock.calls[0][0]);
    expect(record).toMatchObject({
      level: 'info',
      service: 's3-app-backend',
      component: 'TEST',
      event: 'Info message',
      message: 'Info message',
      metadata: { requestId: 'request-1' }
    });
    expect(new Date(record.timestamp).toISOString()).toBe(record.timestamp);
  });

  it('redacts sensitive metadata fields and inline bearer credentials', () => {
    logger.warn('TEST', 'Authorization: Bearer abc.def.ghi', {
      password: 'do-not-log',
      detail: 'Bearer abc.def.ghi'
    });

    const record = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(record.message).not.toContain('abc.def.ghi');
    expect(record.metadata.password).toBe('[REDACTED]');
    expect(record.metadata.detail).not.toContain('abc.def.ghi');
  });

  it('serializes errors with diagnostic context', () => {
    const error = new TypeError('Database unavailable');
    error.code = 'DB_UNAVAILABLE';

    logger.error('TEST', 'Operation failed', error);

    const record = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(record.level).toBe('error');
    expect(record.metadata).toMatchObject({
      name: 'TypeError',
      message: 'Database unavailable',
      code: 'DB_UNAVAILABLE'
    });
    expect(record.metadata.stack).toContain('TypeError: Database unavailable');
  });

  it('redacts credentials embedded in connection strings and error text', () => {
    logger.error('TEST', 'Connection failed', new Error(
      'Could not connect to mongodb://admin:secret-value@db.example.test/app'
    ));

    const record = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(record.metadata.message).not.toContain('secret-value');
    expect(record.metadata.stack).not.toContain('admin:secret-value');
  });
});
