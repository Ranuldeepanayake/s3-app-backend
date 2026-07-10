// Main application entry point for the S3 image CRUD API.
const dotenv = require('dotenv');

dotenv.config();

const express = require('express');
const os = require('os');
const mongoose = require('mongoose');
const multer = require('multer');
const connectDB = require('./config/db');
const imageRoutes = require('./routes/imageRoutes');
const { router: authRouter, authenticateToken } = require('./routes/authRoutes');
const { testS3Connection, isS3Healthy } = require('./config/s3');
const logger = require('./config/logger');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = Number(process.env.PORT || process.env.API_PORT || 3100);
const HOST = process.env.HOST || '0.0.0.0';

const getContainerIp = () => {
  const interfaces = os.networkInterfaces();

  for (const values of Object.values(interfaces)) {
    for (const entry of values || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }

  return 'unknown';
};

const checkHealth = async () => {
  const [mongoHealthy, s3Healthy] = await Promise.all([
    require('./config/db').isMongoHealthy(),
    isS3Healthy()
  ]);

  return {
    status: mongoHealthy && s3Healthy ? 'ok' : 'degraded',
    mongodb: {
      status: mongoHealthy ? 'up' : 'down'
    },
    s3: {
      status: s3Healthy ? 'up' : 'down'
    }
  };
};

// Allow browser-based requests from the React frontend during local development.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

// Log each incoming HTTP request with a timestamp and request method.
app.use((req, res, next) => {
  logger.info('HTTP', `${req.method} ${req.originalUrl}`);
  next();
});

app.get('/', (req, res) => {
  res.json({
    message: 'S3 image CRUD API is running',
    endpoints: {
      upload: 'POST /api/images',
      list: 'GET /api/images',
      getOne: 'GET /api/images/:id',
      update: 'PUT /api/images/:id',
      delete: 'DELETE /api/images/:id',
      healthcheck: 'GET /api/health/live',
      protectedHealthcheck: 'GET /api/health/ready'
    }
  });
});

app.get('/api/health/live', async (req, res) => {
  try {
    const payload = await checkHealth();
    return res.status(payload.status === 'ok' ? 200 : 503).json(payload);
  } catch (error) {
    logger.error('HEALTH', 'Unprotected healthcheck failed', error.message);
    return res.status(503).json({
      status: 'error',
      message: 'Healthcheck failed'
    });
  }
});

app.get('/api/health/ready', authenticateToken, async (req, res) => {
  try {
    const payload = await checkHealth();
    return res.status(payload.status === 'ok' ? 200 : 503).json({
      ...payload,
      container: {
        hostname: os.hostname(),
        ipAddress: getContainerIp()
      },
      aws: {
        region: process.env.AWS_REGION || 'not-set',
        bucketName: process.env.AWS_BUCKET_NAME || 'not-set'
      }
    });
  } catch (error) {
    logger.error('HEALTH', 'Protected healthcheck failed', error.message);
    return res.status(503).json({
      status: 'error',
      message: 'Healthcheck failed'
    });
  }
});

app.use('/api/auth', authRouter);

// Protect image routes so they only run when MongoDB is available.
app.use(
  '/api/images',
  (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
      logger.warn('API', 'Database unavailable for image request');
      return res.status(503).json({
        message: 'Database is unavailable right now. Please try again later.'
      });
    }
    next();
  },
  imageRoutes
);

// Start the server, connect to MongoDB, and verify S3 availability.
const startServer = async () => {
  try {
    logger.info('STARTUP', 'Resolved startup configuration', {
      port: PORT,
      host: HOST,
      mongodbUriConfigured: Boolean(process.env.MONGODB_URI),
      awsBucketConfigured: Boolean(process.env.AWS_BUCKET_NAME),
      awsRegion: process.env.AWS_REGION || 'not-set'
    });

    await connectDB();

    const s3Ready = await testS3Connection();
    if (!s3Ready) {
      logger.warn('STARTUP', 'S3 connection unavailable, but continuing startup.');
    }

    app.listen(PORT, HOST, () => {
      logger.info('STARTUP', `Server running on http://${HOST}:${PORT}`);
    });
  } catch (error) {
    logger.error('STARTUP', 'Failed to start server', error.message);
  }
};

startServer();

// Centralized error handler for unexpected failures.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxSize = Number(process.env.MAX_IMAGE_SIZE_BYTES || 5 * 1024 * 1024);
      return res.status(413).json({
        message: `Image exceeds the maximum allowed size of ${Math.ceil(maxSize / 1024 / 1024)}MB.`
      });
    }

    return res.status(400).json({ message: err.message });
  }

  logger.error('HTTP', `Error on ${req.method} ${req.originalUrl}`, err.message);
  res.status(err.status || 500).json({
    message: 'Internal server error',
    error: err.message
  });
});
