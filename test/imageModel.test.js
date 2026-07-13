const test = require('node:test');
const assert = require('node:assert/strict');

const Image = require('../models/Image');
const imageRoutes = require('../routes/imageRoutes');

test('Image schema keeps only the fields used for fixed-domain image metadata', () => {
  const paths = Object.keys(Image.schema.paths);

  assert.ok(paths.includes('name'));
  assert.ok(paths.includes('fileName'));
  assert.ok(paths.includes('size'));
  assert.ok(paths.includes('mimeType'));
  assert.ok(paths.includes('uploadedAt'));

  assert.ok(!paths.includes('key'));
  assert.ok(!paths.includes('bucket'));
  assert.ok(!paths.includes('signedUrl'));
  assert.ok(!paths.includes('publicUrl'));
});

test('storage keys are generated independently from the display name', () => {
  const storageKey = imageRoutes.buildStorageFileName('photo.jpg');
  const storageKeyWithDifferentCase = imageRoutes.buildStorageFileName('Photo.JPG');

  assert.ok(storageKey.length > 0);
  assert.ok(storageKeyWithDifferentCase.length > 0);
  assert.notEqual(storageKey, 'photo.jpg');
  assert.notEqual(storageKeyWithDifferentCase, 'Photo.JPG');
  assert.notEqual(storageKey, storageKeyWithDifferentCase);
  assert.match(storageKey, /[a-z0-9._-]+-[0-9a-f-]+\.[a-z0-9]+/i);
  assert.match(storageKeyWithDifferentCase, /[a-z0-9._-]+-[0-9a-f-]+\.[a-z0-9]+/i);
});
