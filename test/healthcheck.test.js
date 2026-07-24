const { describe, it, expect, afterEach } = require('@jest/globals');

jest.mock('../src/config/logger.js', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn()
}));

describe('health helpers', () => {
  afterEach(() => {
    delete process.env.AWS_BUCKET_NAME;
  });

  it('returns false when the mongo connection is not ready', async () => {
    const connectDB = require('../src/config/db.js');
    const result = await connectDB.isMongoHealthy();

    expect(result).toBe(false);
  });

  it('returns false when the bucket is not configured', async () => {
    const { isS3Healthy } = require('../src/config/s3.js');
    const originalBucket = process.env.AWS_BUCKET_NAME;

    delete process.env.AWS_BUCKET_NAME;

    try {
      const result = await isS3Healthy();
      expect(result).toBe(false);
    } finally {
      if (originalBucket !== undefined) {
        process.env.AWS_BUCKET_NAME = originalBucket;
      }
    }
  });
});
