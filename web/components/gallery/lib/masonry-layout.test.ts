import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getMasonryLayout,
  getPhotoMasonryHeight,
  getVisibleMasonryIndexes,
} from './masonry-layout'

test('uses monotonic responsive masonry columns', () => {
  const expectedColumnCounts = [
    [319, 1],
    [320, 2],
    [639, 2],
    [640, 3],
    [767, 3],
    [768, 3],
    [959, 3],
    [960, 4],
    [1023, 4],
    [1024, 4],
    [1199, 4],
    [1200, 5],
    [1439, 5],
    [1440, 6],
    [1728, 6],
    [1799, 6],
    [1800, 7],
    [2047, 7],
    [2048, 8],
  ] as const

  expectedColumnCounts.forEach(([width, columnCount]) => {
    assert.equal(getMasonryLayout(width).columnCount, columnCount)
  })

  let previousColumnCount = 1

  for (let width = 1; width <= 2560; width += 1) {
    const { columnCount } = getMasonryLayout(width)

    assert.ok(columnCount >= previousColumnCount)
    previousColumnCount = columnCount
  }
})

test('fills the available width with evenly sized columns', () => {
  assert.deepEqual(getMasonryLayout(390), {
    columnCount: 2,
    columnWidth: 193,
  })
  assert.deepEqual(getMasonryLayout(1023), {
    columnCount: 4,
    columnWidth: 252.75,
  })
  assert.deepEqual(getMasonryLayout(1024), {
    columnCount: 4,
    columnWidth: 253,
  })
  assert.deepEqual(getMasonryLayout(1728), {
    columnCount: 6,
    columnWidth: 854 / 3,
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
