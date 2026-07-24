const { describe, it, expect } = require('@jest/globals');
const logger = require('../src/config/logger');

describe('logger', () => {
  let originalConsoleInfo;
  let originalConsoleWarn;
  let originalConsoleError;
  let infoSpy;
  let warnSpy;
  let errorSpy;

  beforeAll(() => {
    originalConsoleInfo = console.info;
    originalConsoleWarn = console.warn;
    originalConsoleError = console.error;
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('logs info with component and message', () => {
    logger.info('TEST', 'Info message');
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy.mock.calls[0][0]).toMatch(/\[.*\] \[TEST\] Info message/);
  });

  it('logs warn with component and meta', () => {
    logger.warn('TEST', 'Warn message', { reason: 'test' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/\[.*\] \[TEST\] Warn message/);
    expect(warnSpy.mock.calls[0][1]).toEqual({ reason: 'test' });
  });

  it('logs error with component and meta string', () => {
    logger.error('TEST', 'Error message', 'details');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toMatch(/\[.*\] \[TEST\] Error message/);
    expect(errorSpy.mock.calls[0][1]).toBe('details');
  });
});
