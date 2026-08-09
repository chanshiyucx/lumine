import assert from 'node:assert/strict'
import test from 'node:test'
import { getMasonryImageLoading } from './masonry-layout'

test('eagerly loads an image that intersects the viewport', () => {
  assert.equal(
    getMasonryImageLoading({ start: 221, end: 600 }, 48, 800),
    'eager',
  )
})

test('lazily loads images outside the viewport', () => {
  assert.equal(
    getMasonryImageLoading({ start: 800, end: 1000 }, 48, 800),
    'lazy',
  )
  assert.equal(getMasonryImageLoading({ start: 0, end: 48 }, 48, 800), 'lazy')
})
