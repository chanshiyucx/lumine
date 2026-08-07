import assert from 'node:assert/strict'
import test from 'node:test'
import {
  shouldDismissMobilePreview,
  shouldPreviewClusterOnTouch,
} from './map-preview-interaction'

test('opens the cluster preview on touch when no further cluster zoom exists', () => {
  assert.equal(
    shouldPreviewClusterOnTouch({
      canHover: false,
      expansionZoom: 16,
      maxClusterZoom: 15,
    }),
    true,
  )
})

test('continues expanding touch clusters while another cluster zoom exists', () => {
  assert.equal(
    shouldPreviewClusterOnTouch({
      canHover: false,
      expansionZoom: 8,
      maxClusterZoom: 15,
    }),
    false,
  )
})

test('desktop clusters always keep their click-to-expand behavior', () => {
  assert.equal(
    shouldPreviewClusterOnTouch({
      canHover: true,
      expansionZoom: 16,
      maxClusterZoom: 15,
    }),
    false,
  )
})

test('dismisses the mobile preview after a long downward drag', () => {
  assert.equal(
    shouldDismissMobilePreview({ distance: 72, elapsedMs: 400 }),
    true,
  )
})

test('dismisses the mobile preview after a quick downward flick', () => {
  assert.equal(
    shouldDismissMobilePreview({ distance: 36, elapsedMs: 50 }),
    true,
  )
})

test('settles the mobile preview after a short slow drag', () => {
  assert.equal(
    shouldDismissMobilePreview({ distance: 30, elapsedMs: 300 }),
    false,
  )
})
