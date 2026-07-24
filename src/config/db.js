// MongoDB connection helper for the application.

const mongoose = require('mongoose');
const logger = require('./logger');

const reconnectTimers = new Set();
const isTestEnvironment = () => process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

const clearReconnectTimers = () => {
  reconnectTimers.forEach((timer) => clearTimeout(timer));
  reconnectTimers.clear();
};

const scheduleReconnect = (delayMs = 5000) => {
  if (isTestEnvironment()) {
    return null;
  }

  const timer = setTimeout(() => {
    reconnectTimers.delete(timer);
    connectDB();
  }, delayMs);

  reconnectTimers.add(timer);
  return timer;
};

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

  clearReconnectTimers();

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true
    });
    logger.info('MONGO', 'MongoDB connected');
  } catch (error) {
    logger.error('MONGO', 'MongoDB connection error', error.message);
    logger.info('MONGO', 'Retrying MongoDB connection in 5 seconds...');
    scheduleReconnect();
  }
};

// Reconnect after dropped connections so transient database restarts do not
// require restarting the API process.
mongoose.connection.on('disconnected', () => {
  if (isTestEnvironment()) {
    return;
  }

  logger.warn('MONGO', 'MongoDB disconnected. Retrying connection...');
  scheduleReconnect();
});

// Handle MongoDB runtime errors.
mongoose.connection.on('error', (error) => {
  logger.error('MONGO', 'MongoDB runtime error', error.message);
});

module.exports = connectDB;
module.exports.isMongoHealthy = isMongoHealthy;
module.exports.clearReconnectTimers = clearReconnectTimers;
