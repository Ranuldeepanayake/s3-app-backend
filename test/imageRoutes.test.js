const { describe, it, expect } = require('@jest/globals');
const fs = require('fs');
const path = require('path');

jest.mock('../src/config/logger.js', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn()
}));

const imageRoutes = require('../src/routes/imageRoutes.js');

const tempDir = path.join(__dirname, '..', 'src', 'tmp');

describe('imageRoutes utilities', () => {
  it('buildStorageFileName creates a safe unique filename', () => {
    const name = imageRoutes.buildStorageFileName('My Image.PNG');
    expect(name).toMatch(/^My-Image-\d{13}-[0-9a-fA-F-]{36}\.png$/);
  });

  it('createCloudFrontUrl returns null when domain is missing', () => {
    const url = imageRoutes.createCloudFrontUrl('image.jpg');
    expect(url).toBeNull();
  });

  it('serializeImage adds url and fileName fields', () => {
    const mocked = {
      toObject: () => ({ imageId: 'abc', fileName: 'image.jpg', name: 'image.jpg' })
    };
    const result = imageRoutes.serializeImage(mocked);
    expect(result.fileName).toBe('image.jpg');
    expect(result.url).toBeNull();
  });

  it('findImageByIdentifier returns null for missing id', async () => {
    const result = await imageRoutes.findImageByIdentifier(null);
    expect(result).toBeNull();
  });
});

describe('imageRoutes temp directory', () => {
  it('ensures the tmp directory exists', () => {
    expect(fs.existsSync(tempDir)).toBe(true);
  });
});
