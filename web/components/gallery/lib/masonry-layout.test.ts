import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getMasonryLayout,
  getPhotoMasonryHeight,
  getVisibleMasonryIndexes,
} from './masonry-layout'

test('fills the available width with responsive masonry columns', () => {
  assert.deepEqual(getMasonryLayout(390), {
    columnCount: 2,
    columnWidth: 193,
  })
  assert.deepEqual(getMasonryLayout(1023), {
    columnCount: 6,
    columnWidth: 1003 / 6,
  })
  assert.deepEqual(getMasonryLayout(1024), {
    columnCount: 4,
    columnWidth: 253,
  })
})

test('limits wide desktop layouts to eight columns', () => {
  assert.deepEqual(getMasonryLayout(2560), {
    columnCount: 8,
    columnWidth: 316.5,
  })
})

test('calculates exact masonry heights from the rendered column width', () => {
  assert.equal(getPhotoMasonryHeight({ aspectRatio: 2 }, 320), 160)
  assert.equal(getPhotoMasonryHeight({ aspectRatio: 0.8 }, 320), 400)
})

test('preserves fractional heights for subpixel browser layout', () => {
  assert.equal(getPhotoMasonryHeight({ aspectRatio: 3 }, 250), 250 / 3)
})

test('excludes overscan items outside the visible viewport', () => {
  const positions = [
    { index: 0, start: 0, end: 100 },
    { index: 1, start: 104, end: 204 },
    { index: 2, start: 208, end: 308 },
    { index: 3, start: 312, end: 412 },
  ]

  assert.deepEqual(getVisibleMasonryIndexes(positions, 100, 312), [1, 2])
})
