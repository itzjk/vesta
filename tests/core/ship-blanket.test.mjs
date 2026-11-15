import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { blanketFolds, blanketRows, blanketPixels } from '../../web/js/scene/ship-blanket.js';

test('blanket pixels preserve measured hashes from the original ship generator', () => {
  for (const [size, expected] of [[8, 'c2a72ec68dc3954598bcbcb4c1673a7a0dd1c04c6c4ae5615f0a60a642a0e0a4'], [16, '98543cddf836425df2881c28a926336e9a45960ea125917f3233059f93674547']]) {
    assert.equal(createHash('sha256').update(blanketPixels(size)).digest('hex'), expected);
  }
});

test('chunk boundaries preserve every pixel and leave later rows untouched', () => {
  const size = 16, pixels = new Uint8ClampedArray(size * size * 4), folds = blanketFolds(size);
  blanketRows(size, pixels, folds, 0, 4);
  assert.ok(pixels.slice(4 * size * 4).every(value => value === 0));
  for (let row = 4; row < size; row += 4) blanketRows(size, pixels, folds, row, row + 4);
  assert.deepEqual(pixels, blanketPixels(size));
  for (let i = 0; i < pixels.length; i += 4) { assert.equal(pixels[i], pixels[i + 1]); assert.equal(pixels[i], pixels[i + 2]); assert.equal(pixels[i + 3], 255); }
});
