import assert from 'node:assert/strict'
import test from 'node:test'
import {
  expandMapBounds,
  getMapMarkerImageLoading,
  isPointWithinMapBounds,
} from './map-viewport'

test('expands map bounds by the requested ratio on every side', () => {
  assert.deepEqual(expandMapBounds([-10, -20, 10, 20], 0.25), [
    -15, -30, 15, 30,
  ])
})

test('clamps expanded latitude bounds to the valid range', () => {
  assert.deepEqual(expandMapBounds([-10, -80, 10, 80], 0.25), [
    -15, -90, 15, 90,
  ])
})

test('detects points inside bounds that cross the antimeridian', () => {
  assert.equal(isPointWithinMapBounds(175, 0, [170, -10, -170, 10]), true)
  assert.equal(isPointWithinMapBounds(-175, 0, [170, -10, -170, 10]), true)
  assert.equal(isPointWithinMapBounds(0, 0, [170, -10, -170, 10]), false)
})

test('eagerly loads viewport markers and lazily loads overscan markers', () => {
  const viewportBounds: [number, number, number, number] = [-10, -10, 10, 10]

  assert.equal(getMapMarkerImageLoading(0, 0, viewportBounds), 'eager')
  assert.equal(getMapMarkerImageLoading(12, 0, viewportBounds), 'lazy')
})
