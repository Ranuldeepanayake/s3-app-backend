// Main application entry point for the S3 image CRUD API.
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const imageRoutes = require('./routes/imageRoutes');
const { testS3Connection } = require('./config/s3');
const logger = require('./config/logger');

dotenv.config();

const app = express();

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
      delete: 'DELETE /api/images/:id'
    }
  });
});

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

const PORT = Number(process.env.PORT || process.env.API_PORT || 3100);
const HOST = process.env.HOST || '0.0.0.0';

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
  logger.error('HTTP', `Error on ${req.method} ${req.originalUrl}`, err.message);
  res.status(err.status || 500).json({
    message: 'Internal server error',
    error: err.message
  });
});
