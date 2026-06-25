// Route handlers for image upload, retrieval, update, and deletion.
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');

const { s3Client } = require('../config/s3');
const Image = require('../models/Image');
const logger = require('../config/logger');

const router = express.Router();

// Store uploaded files in a temporary directory rather than memory.
const uploadDir = path.join(__dirname, '..', 'tmp');

if (!fs.existsSync(uploadDir)) {
  logger.info('ROUTES', `Creating upload temp directory at ${uploadDir}`);
  fs.mkdirSync(uploadDir, { recursive: true });
} else {
  logger.info('ROUTES', `Using existing upload temp directory at ${uploadDir}`);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${uuidv4()}-${file.originalname}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const bucketName = process.env.AWS_BUCKET_NAME;
const urlExpiration = Number(process.env.AWS_URL_EXPIRATION || 3600);

// Generate a signed URL for an object in S3.
const createSignedUrl = async (key) => {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key
  });

  return getSignedUrl(s3Client, command, { expiresIn: urlExpiration });
};

const serializeImage = async (imageDoc) => {
  const image = imageDoc.toObject();
  image.url = await createSignedUrl(image.key);
  return image;
};

const findImageByIdentifier = async (identifier) => {
  return Image.findOne({
    $or: [{ _id: identifier }, { imageId: identifier }]
  });
};

// Upload a new image to S3 and store metadata in MongoDB.
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided.' });
    }

    logger.info('ROUTES', `Uploading image ${req.file.originalname} to S3`);
    logger.info('ROUTES', `Temporary file created at ${req.file.path}`);
    const key = `${Date.now()}-${uuidv4()}-${req.file.originalname}`;
    const imageId = uuidv4();
    logger.info('ROUTES', `Reading temporary file ${req.file.path} for S3 upload`);
    const fileBuffer = fs.readFileSync(req.file.path);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: req.file.mimetype
      })
    );

    logger.info('ROUTES', `Deleting temporary file ${req.file.path} after upload`);
    fs.unlinkSync(req.file.path);

    const image = await Image.create({
      imageId,
      name: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      key,
      bucket: bucketName
    });

    const response = await serializeImage(image);

    res.status(201).json({
      message: 'Image uploaded successfully.',
      image: response
    });
  } catch (error) {
    logger.error('ROUTES', 'Upload error', error.message);
    res.status(500).json({ message: 'Failed to upload image.', error: error.message });
  }
});

// List all stored images and return signed URLs.
router.get('/', async (req, res) => {
  try {
    const images = await Image.find().sort({ uploadedAt: -1 });
    const serialized = await Promise.all(images.map((image) => serializeImage(image)));

    res.json(serialized);
  } catch (error) {
    logger.error('ROUTES', 'List images error', error.message);
    res.status(500).json({ message: 'Failed to fetch images.', error: error.message });
  }
});

// Get a single image by ID or imageId.
router.get('/:id', async (req, res) => {
  try {
    const image = await findImageByIdentifier(req.params.id);

    if (!image) {
      return res.status(404).json({ message: 'Image not found.' });
    }

    const response = await serializeImage(image);

    res.json(response);
  } catch (error) {
    logger.error('ROUTES', 'Get image error', error.message);
    res.status(500).json({ message: 'Failed to fetch image.', error: error.message });
  }
});

// Update an existing image, replacing the object in S3 if a new file is supplied.
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const image = await findImageByIdentifier(req.params.id);

    if (!image) {
      return res.status(404).json({ message: 'Image not found.' });
    }

    let updatedImage = image;

    if (req.file) {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: image.bucket,
          Key: image.key
        })
      );

      const newKey = `${Date.now()}-${uuidv4()}-${req.file.originalname}`;
      logger.info('ROUTES', `Temporary file created at ${req.file.path} for update`);
      logger.info('ROUTES', `Reading temporary file ${req.file.path} for update upload`);
      const fileBuffer = fs.readFileSync(req.file.path);

      await s3Client.send(
        new PutObjectCommand({
          Bucket: image.bucket,
          Key: newKey,
          Body: fileBuffer,
          ContentType: req.file.mimetype
        })
      );

      logger.info('ROUTES', `Deleting temporary file ${req.file.path} after update upload`);
      fs.unlinkSync(req.file.path);

      updatedImage.name = req.file.originalname;
      updatedImage.size = req.file.size;
      updatedImage.mimeType = req.file.mimetype;
      updatedImage.key = newKey;
    }

    if (req.body.name) {
      updatedImage.name = req.body.name;
    }

    updatedImage = await updatedImage.save();
    const response = await serializeImage(updatedImage);

    res.json({
      message: 'Image updated successfully.',
      image: response
    });
  } catch (error) {
    logger.error('ROUTES', 'Update image error', error.message);
    res.status(500).json({ message: 'Failed to update image.', error: error.message });
  }
});

// Delete an image from S3 and its metadata from MongoDB.
router.delete('/:id', async (req, res) => {
  try {
    const image = await findImageByIdentifier(req.params.id);

    if (!image) {
      return res.status(404).json({ message: 'Image not found.' });
    }

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: image.bucket,
        Key: image.key
      })
    );

    await Image.deleteOne({ _id: image._id });

    res.json({ message: 'Image deleted successfully.', id: image.imageId });
  } catch (error) {
    logger.error('ROUTES', 'Delete image error', error.message);
    res.status(500).json({ message: 'Failed to delete image.', error: error.message });
  }
});

module.exports = router;
