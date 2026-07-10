// AWS S3 client setup and connection health check helper.

const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');
const logger = require('./logger');

// A single S3 client is shared by all route handlers. The AWS SDK handles
// connection reuse and request signing for each command sent through it.
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// HeadBucket is a cheap permission and existence check for the configured
// bucket; it does not read or list user image objects.
const isS3Healthy = async () => {
  const bucketName = process.env.AWS_BUCKET_NAME;

  if (!bucketName) {
    logger.error('S3', 'AWS_BUCKET_NAME is not configured.');
    return false;
  }

  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    return true;
  } catch (error) {
    logger.warn('S3', 'S3 healthcheck failed', error.message);
    return false;
  }
};

// Test S3 connection by checking if the specified bucket exists and is
// accessible, retrying to absorb short-lived AWS/network failures at startup.
const testS3Connection = async ({ retries = 3, delayMs = 2000 } = {}) => {
  const bucketName = process.env.AWS_BUCKET_NAME;

  if (!bucketName) {
    logger.error('S3', 'AWS_BUCKET_NAME is not configured.');
    return false;
  }

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      logger.info('S3', `Attempt ${attempt}/${retries}: testing access to bucket "${bucketName}"...`);
      const healthy = await isS3Healthy();
      if (!healthy) {
        throw new Error('S3 healthcheck returned unhealthy');
      }
      logger.info('S3', `Connection successful for bucket "${bucketName}".`);
      return true;
    } catch (error) {
      logger.error('S3', `Attempt ${attempt}/${retries} failed`, error.message);
      if (attempt < retries) {
        logger.info('S3', `Retrying in ${delayMs / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  logger.error('S3', 'Connection failed after all retries.');
  return false;
};

module.exports = {
  s3Client,
  testS3Connection,
  isS3Healthy
};
