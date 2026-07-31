import assert from 'node:assert/strict'
import test from 'node:test'
import {
  fitMediaFrame,
  getFrameTransform,
  projectViewerFrame,
} from './viewer-frame'

test('fits landscape and portrait media inside the measured stage', () => {
  assert.deepEqual(
    fitMediaFrame(
      { width: 4000, height: 3000 },
      { left: 10, top: 20, width: 1000, height: 800 },
    ),
    {
      borderRadius: 0,
      left: 10,
      top: 45,
      width: 1000,
      height: 750,
    },
  )

  assert.deepEqual(
    fitMediaFrame(
      { width: 3000, height: 4000 },
      { left: 10, top: 20, width: 1000, height: 800 },
    ),
    {
      borderRadius: 0,
      left: 210,
      top: 20,
      width: 600,
      height: 800,
    },
  )
})

test('derives a transform-only FLIP projection between frames', () => {
  assert.deepEqual(
    getFrameTransform(
      { left: 50, top: 70, width: 200, height: 100 },
      { left: 10, top: 20, width: 800, height: 400 },
    ),
    {
      x: 40,
      y: 50,
      scaleX: 0.25,
      scaleY: 0.25,
    },
  )
})

test('projects a dragged mobile frame from the same visual origin', () => {
  const projected = projectViewerFrame(
    {
      borderRadius: 0,
      left: 100,
      top: 120,
      width: 300,
      height: 200,
    },
    { left: 0, top: 0, width: 1000, height: 800 },
    {
      borderRadius: 14,
      rotate: 3,
      scale: 0.9,
      translateX: 40,
      translateY: 80,
    },
  )

  assert.equal(projected.left, 180)
  assert.equal(projected.top, 202.4)
  assert.equal(projected.width, 270)
  assert.equal(projected.height, 180)
})
