const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const imageRoutes = require('./routes/imageRoutes');

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
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

app.use(
  '/api/images',
  (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'Database is unavailable right now. Please try again later.'
      });
    }
    next();
  },
  imageRoutes
);

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
  }
};

startServer();

app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Error on ${req.method} ${req.originalUrl}:`, err.message);
  res.status(err.status || 500).json({
    message: 'Internal server error',
    error: err.message
  });
});
