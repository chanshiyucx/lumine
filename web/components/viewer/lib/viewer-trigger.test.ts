import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isUsableViewerTrigger,
  VIEWER_TRIGGER_ATTRIBUTE,
} from './viewer-trigger'

function createTrigger(
  photoId: string,
  options: { connected?: boolean; left?: number; top?: number } = {},
) {
  const { connected = true, left = 10, top = 10 } = options

  return {
    getAttribute: (name: string) =>
      name === VIEWER_TRIGGER_ATTRIBUTE ? photoId : null,
    getBoundingClientRect: () => ({
      bottom: top + 100,
      height: 100,
      left,
      right: left + 100,
      top,
      width: 100,
    }),
    isConnected: connected,
  }
}

test('accepts only connected, matching and visible triggers', () => {
  const viewport = { width: 390, height: 844 }

  assert.equal(isUsableViewerTrigger(createTrigger('a'), 'a', viewport), true)
  assert.equal(isUsableViewerTrigger(createTrigger('a'), 'b', viewport), false)
  assert.equal(
    isUsableViewerTrigger(
      createTrigger('a', { connected: false }),
      'a',
      viewport,
    ),
    false,
  )
  assert.equal(
    isUsableViewerTrigger(createTrigger('a', { top: 900 }), 'a', viewport),
    false,
  )
  assert.equal(
    isUsableViewerTrigger(createTrigger('a', { left: -200 }), 'a', viewport),
    false,
  )
})
