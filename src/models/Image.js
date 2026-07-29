// MongoDB document for image metadata.
// The actual binary file is stored in S3 and served through the configured
// public domain. MongoDB only keeps the metadata needed to list, update, and
// delete those objects from the application.

const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema(
  {
    // MongoDB-generated primary key for the document. This is the database
    // identifier used internally by Mongoose and MongoDB.
    imageId: {
      type: String,
      required: true,
      unique: true
    },
    // Human-readable name shown in the UI and API responses.
    name: {
      type: String,
      required: true
    },
    // The file name used as the object key in S3. It is also used to build the
    // public render URL from the configured fixed domain.
    fileName: {
      type: String,
      required: true,
      index: true
    },
    // Size of the uploaded file in bytes.
    size: {
      type: Number,
      required: true
    },
    // MIME type of the uploaded file, used by the client and S3 metadata.
    mimeType: {
      type: String,
      required: true
    },
    // Original upload timestamp. This is kept separate from the automatic
    // timestamps added by Mongoose so the API can surface the real upload time.
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    // createdAt/updatedAt are automatic audit timestamps from Mongoose.
    // uploadedAt preserves the original user-facing upload time.
    timestamps: true
  }
);

module.exports = mongoose.model('Image', imageSchema);
