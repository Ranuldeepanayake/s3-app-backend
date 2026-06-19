const mongoose = require('mongoose');

const connectDB = async () => {
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    console.log('Retrying MongoDB connection in 5 seconds...');
    setTimeout(() => {
      connectDB();
    }, 5000);
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected. Retrying connection...');
  setTimeout(() => {
    connectDB();
  }, 5000);
});

mongoose.connection.on('error', (error) => {
  console.error('MongoDB runtime error:', error.message);
});

module.exports = connectDB;
