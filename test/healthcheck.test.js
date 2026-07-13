const test = require('node:test');
const assert = require('node:assert/strict');

test('mongo health helper returns false when the connection is not ready', async () => {
  const connectDB = require('../config/db');
  const result = await connectDB.isMongoHealthy();

  assert.equal(result, false);
});

test('s3 health helper returns false when the bucket is not configured', async () => {
  const { isS3Healthy } = require('../config/s3');
  const originalBucket = process.env.AWS_BUCKET_NAME;

  delete process.env.AWS_BUCKET_NAME;

  try {
    const result = await isS3Healthy();
    assert.equal(result, false);
  } finally {
    if (originalBucket !== undefined) {
      process.env.AWS_BUCKET_NAME = originalBucket;
    }
  }
});
