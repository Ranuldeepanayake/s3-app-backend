const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const imageRoutes = require('./routes/imageRoutes');

dotenv.config();
connectDB();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.use('/api/images', imageRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
