import assert from 'node:assert/strict'
import test from 'node:test'
import { VIEWER_MOTION } from './viewer-motion'

const EPSILON = 0.000_001

function assertAligned(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < EPSILON)
}

test('entry surfaces start apart and settle with the shared transition', () => {
  const sharedSettleTime =
    VIEWER_MOTION.sharedEnter.duration + VIEWER_MOTION.contentFade.duration
  const panelSettleTime =
    VIEWER_MOTION.sharedEntryHandoffDelay +
    VIEWER_MOTION.chrome.panel.enter.duration
  const railSettleTime =
    VIEWER_MOTION.sharedEntryHandoffDelay +
    VIEWER_MOTION.chrome.rail.enter.delay +
    VIEWER_MOTION.chrome.rail.enter.duration

  assertAligned(panelSettleTime, sharedSettleTime)
  assertAligned(railSettleTime, sharedSettleTime)
  assert.equal(VIEWER_MOTION.chrome.rail.enter.delay, 0.04)
})

test('exit surfaces start apart and settle together', () => {
  const panelSettleTime = VIEWER_MOTION.chrome.panel.exit.duration
  const railSettleTime =
    VIEWER_MOTION.chrome.rail.exit.delay +
    VIEWER_MOTION.chrome.rail.exit.duration

  assertAligned(railSettleTime, panelSettleTime)
  assert.equal(VIEWER_MOTION.chrome.rail.exit.delay, 0.04)
})

test('backdrop motion frames the shared transition without delaying chrome', () => {
  assert.ok(
    VIEWER_MOTION.backdropEnter.duration <
      VIEWER_MOTION.sharedEntryHandoffDelay,
  )
  assert.ok(
    VIEWER_MOTION.chrome.toolbar.exit.duration <
      VIEWER_MOTION.backdropExit.duration,
  )
  assert.ok(
    VIEWER_MOTION.backdropExit.duration <
      VIEWER_MOTION.chrome.panel.exit.duration,
  )
  assert.ok(
    VIEWER_MOTION.chrome.panel.exit.duration <
      VIEWER_MOTION.sharedExit.duration,
  )
})

test('photo backdrop crossfade stays aligned with carousel navigation', () => {
  assert.equal(VIEWER_MOTION.photoSwitch.duration, 0.3)
  assert.equal(VIEWER_MOTION.photoSwitch.ease, 'linear')
})

test('inspector settles without elastic overshoot', () => {
  assert.equal(VIEWER_MOTION.inspector.open.type, 'spring')
  assert.equal(VIEWER_MOTION.inspector.open.duration, 0.32)
  assert.equal(VIEWER_MOTION.inspector.open.bounce, 0)
  assert.equal(VIEWER_MOTION.inspector.close.type, 'spring')
  assert.equal(VIEWER_MOTION.inspector.close.duration, 0.28)
  assert.equal(VIEWER_MOTION.inspector.close.bounce, 0)
})
