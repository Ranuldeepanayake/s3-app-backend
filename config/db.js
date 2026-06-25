// MongoDB connection helper for the application.

const mongoose = require('mongoose');
const logger = require('./logger');

// Connect to MongoDB with retry logic on failure.
const connectDB = async () => {
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true
    });
    logger.info('MONGO', 'MongoDB connected');
  } catch (error) {
    logger.error('MONGO', 'MongoDB connection error', error.message);
    logger.info('MONGO', 'Retrying MongoDB connection in 5 seconds...');
    setTimeout(() => {
      connectDB();
    }, 5000);
  }
};

// Handle MongoDB disconnection and errors.
mongoose.connection.on('disconnected', () => {
  logger.warn('MONGO', 'MongoDB disconnected. Retrying connection...');
  setTimeout(() => {
    connectDB();
  }, 5000);
});

// Handle MongoDB runtime errors.
mongoose.connection.on('error', (error) => {
  logger.error('MONGO', 'MongoDB runtime error', error.message);
});

module.exports = connectDB;
