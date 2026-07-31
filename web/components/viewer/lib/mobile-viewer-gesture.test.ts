import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getDismissPresentation,
  getMobileGestureMetrics,
  shouldDismissViewer,
} from './mobile-viewer-gesture'

test('clamps dismiss thresholds across short and tall viewports', () => {
  assert.equal(getMobileGestureMetrics(500).dismissThreshold, 120)
  assert.equal(getMobileGestureMetrics(844).dismissThreshold, 151.92)
  assert.equal(getMobileGestureMetrics(1400).dismissThreshold, 180)
})

test('dismisses by distance or by a deliberate downward throw', () => {
  assert.equal(
    shouldDismissViewer({
      distance: 160,
      directionY: 1,
      threshold: 150,
      velocityY: 0.2,
    }),
    true,
  )
  assert.equal(
    shouldDismissViewer({
      distance: 40,
      directionY: 1,
      threshold: 150,
      velocityY: 0.8,
    }),
    true,
  )
  assert.equal(
    shouldDismissViewer({
      distance: 35,
      directionY: 1,
      threshold: 150,
      velocityY: 0.8,
    }),
    false,
  )
})

test('keeps mobile dismiss presentation intentionally restrained', () => {
  const presentation = getDismissPresentation(390, 1004, 1004, 390)

  assert.equal(presentation.scale, 0.87)
  assert.equal(presentation.rotate, 3)
  assert.equal(presentation.borderRadius, 20)
  assert.equal(presentation.backdropOpacity, 0.14)
})
