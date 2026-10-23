const { describe, it, expect } = require('@jest/globals');

jest.mock('../src/config/logger.js', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn()
}));

const { parseTrustProxy, configureTrustProxy } = require('../src/config/trustProxy.js');

describe('trust proxy configuration', () => {
  it('defaults to false when TRUST_PROXY is not set', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('')).toBe(false);
  });

  it('supports boolean values', () => {
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('false')).toBe(false);
  });

  it('supports numeric proxy hop counts', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('2')).toBe(2);
  });

  it('applies the resolved setting to express', () => {
    const app = {
      value: undefined,
      set(key, value) {
        if (key === 'trust proxy') {
          this.value = value;
        }
      }
    };
    const originalTrustProxy = process.env.TRUST_PROXY;
    process.env.TRUST_PROXY = '1';

    try {
      expect(configureTrustProxy(app)).toBe(1);
      expect(app.value).toBe(1);
    } finally {
      if (originalTrustProxy === undefined) {
        delete process.env.TRUST_PROXY;
      } else {
        process.env.TRUST_PROXY = originalTrustProxy;
      }
    }
  });
});
