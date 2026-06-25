// AWS S3 client setup and connection health check helper.
const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');
const logger = require('./logger');

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const testS3Connection = async ({ retries = 3, delayMs = 2000 } = {}) => {
  const bucketName = process.env.AWS_BUCKET_NAME;

  if (!bucketName) {
    logger.error('S3', 'AWS_BUCKET_NAME is not configured.');
    return false;
  }

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      logger.info('S3', `Attempt ${attempt}/${retries}: testing access to bucket "${bucketName}"...`);
      await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
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
  testS3Connection
};
