// MongoDB connection helper for the application.

const mongoose = require('mongoose');
const logger = require('./logger');

// Uses MongoDB's ping command instead of only checking Mongoose state, because
// the driver can be connected while the server is no longer reachable.
const isMongoHealthy = async () => {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return false;
  }

  try {
    await mongoose.connection.db.admin().ping();
    return true;
  } catch (error) {
    logger.warn('MONGO', 'MongoDB healthcheck failed', error.message);
    return false;
  }
};

// Connect to MongoDB with retry logic on failure. The readyState guard prevents
// duplicate connection attempts while an existing attempt is still pending.
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

// Reconnect after dropped connections so transient database restarts do not
// require restarting the API process.
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
module.exports.isMongoHealthy = isMongoHealthy;
