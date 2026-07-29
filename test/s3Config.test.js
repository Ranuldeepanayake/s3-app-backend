const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({
    send: jest.fn()
  })),
  HeadBucketCommand: jest.fn()
}));

jest.mock('../src/config/logger.js', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

describe('s3 config', () => {
  let originalBucket;
  let clientMock;
  let isS3Healthy;
  let testS3Connection;

  beforeEach(() => {
    originalBucket = process.env.AWS_BUCKET_NAME;
    process.env.AWS_BUCKET_NAME = 'test-bucket';
    jest.resetModules();
    const { s3Client, isS3Healthy: healthFn, testS3Connection: connectionFn } = require('../src/config/s3.js');
    clientMock = s3Client;
    isS3Healthy = healthFn;
    testS3Connection = connectionFn;
  });

  afterEach(() => {
    process.env.AWS_BUCKET_NAME = originalBucket;
    jest.clearAllMocks();
  });

  it('returns false when bucket name is not configured', async () => {
    process.env.AWS_BUCKET_NAME = '';
    const result = await isS3Healthy();
    expect(result).toBe(false);
  });

  it('returns true when S3 health check passes', async () => {
    clientMock.send.mockResolvedValue({});
    const result = await isS3Healthy();
    expect(result).toBe(true);
  });

  it('retries and returns false when bucket access fails', async () => {
    clientMock.send.mockRejectedValue(new Error('Access denied'));
    const result = await testS3Connection({ retries: 2, delayMs: 1 });
    expect(result).toBe(false);
  });
});
