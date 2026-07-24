const { describe, it, expect } = require('@jest/globals');

const Image = require('../src/models/Image.js');
const imageRoutes = require('../src/routes/imageRoutes.js');

describe('image metadata model', () => {
  it('keeps only the fields used for fixed-domain image metadata', () => {
    const paths = Object.keys(Image.schema.paths);

    expect(paths).toContain('name');
    expect(paths).toContain('fileName');
    expect(paths).toContain('size');
    expect(paths).toContain('mimeType');
    expect(paths).toContain('uploadedAt');

    expect(paths).not.toContain('key');
    expect(paths).not.toContain('bucket');
    expect(paths).not.toContain('signedUrl');
    expect(paths).not.toContain('publicUrl');
  });

  it('generates storage keys independently from the display name', () => {
    const storageKey = imageRoutes.buildStorageFileName('photo.jpg');
    const storageKeyWithDifferentCase = imageRoutes.buildStorageFileName('Photo.JPG');

    expect(storageKey.length).toBeGreaterThan(0);
    expect(storageKeyWithDifferentCase.length).toBeGreaterThan(0);
    expect(storageKey).not.toBe('photo.jpg');
    expect(storageKeyWithDifferentCase).not.toBe('Photo.JPG');
    expect(storageKey).not.toBe(storageKeyWithDifferentCase);
    expect(storageKey).toMatch(/[a-z0-9._-]+-[0-9a-f-]+\.[a-z0-9]+/i);
    expect(storageKeyWithDifferentCase).toMatch(/[a-z0-9._-]+-[0-9a-f-]+\.[a-z0-9]+/i);
  });
});
