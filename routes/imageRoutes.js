const express = require('express');
const multer = require('multer');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');

const s3Client = require('../config/s3');
const Image = require('../models/Image');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
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

router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided.' });
    }

    const key = `${Date.now()}-${uuidv4()}-${req.file.originalname}`;
    const imageId = uuidv4();

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype
      })
    );

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
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Failed to upload image.', error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const images = await Image.find().sort({ uploadedAt: -1 });
    const serialized = await Promise.all(images.map((image) => serializeImage(image)));

    res.json(serialized);
  } catch (error) {
    console.error('List images error:', error);
    res.status(500).json({ message: 'Failed to fetch images.', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const image = await findImageByIdentifier(req.params.id);

    if (!image) {
      return res.status(404).json({ message: 'Image not found.' });
    }

    const response = await serializeImage(image);

    res.json(response);
  } catch (error) {
    console.error('Get image error:', error);
    res.status(500).json({ message: 'Failed to fetch image.', error: error.message });
  }
});

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

      await s3Client.send(
        new PutObjectCommand({
          Bucket: image.bucket,
          Key: newKey,
          Body: req.file.buffer,
          ContentType: req.file.mimetype
        })
      );

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
    console.error('Update image error:', error);
    res.status(500).json({ message: 'Failed to update image.', error: error.message });
  }
});

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
    console.error('Delete image error:', error);
    res.status(500).json({ message: 'Failed to delete image.', error: error.message });
  }
});

module.exports = router;
