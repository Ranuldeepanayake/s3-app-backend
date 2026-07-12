// Database model for image metadata. The binary image bytes live in S3 and are
// rendered through CloudFront; MongoDB stores the lookup data needed to list,
// update, and delete those objects.

const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema(
  {
    imageId: {
      type: String,
      required: true,
      unique: true
    },
    name: {
      type: String,
      required: true
    },
    fileName: {
      type: String,
      required: true,
      index: true
    },
    size: {
      type: Number,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    key: {
      type: String,
      required: true
    },
    bucket: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    // createdAt/updatedAt are useful for auditing edits; uploadedAt preserves
    // the original user-facing upload time.
    timestamps: true
  }
);

module.exports = mongoose.model('Image', imageSchema);
