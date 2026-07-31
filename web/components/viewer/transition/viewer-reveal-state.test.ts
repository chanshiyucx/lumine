import assert from 'node:assert/strict'
import test from 'node:test'
import {
  advanceViewerRevealState,
  createViewerRevealState,
  hasViewerRevealStage,
} from './viewer-reveal-state'

test('advances one operation through the reveal stages', () => {
  const hidden = createViewerRevealState(3, 'hidden')
  const surfaces = advanceViewerRevealState(hidden, 3, 'surfaces')
  const controls = advanceViewerRevealState(surfaces, 3, 'controls')

  assert.deepEqual(surfaces, { operationId: 3, stage: 'surfaces' })
  assert.deepEqual(controls, { operationId: 3, stage: 'controls' })
  assert.equal(hasViewerRevealStage(controls, 3, 'surfaces'), true)
  assert.equal(hasViewerRevealStage(controls, 3, 'controls'), true)
})

test('does not move an operation back to an earlier reveal stage', () => {
  const controls = createViewerRevealState(3, 'controls')

  assert.equal(advanceViewerRevealState(controls, 3, 'surfaces'), controls)
  assert.equal(advanceViewerRevealState(controls, 3, 'hidden'), controls)
})

test('ignores a stale completion after a newer operation starts', () => {
  const nextEntry = createViewerRevealState(4, 'hidden')

  assert.equal(advanceViewerRevealState(nextEntry, 3, 'controls'), nextEntry)
  assert.equal(hasViewerRevealStage(nextEntry, 4, 'surfaces'), false)
})

test('allows a newer operation to start its own reveal sequence', () => {
  const previousControls = createViewerRevealState(3, 'controls')
  const nextSurfaces = advanceViewerRevealState(previousControls, 4, 'surfaces')

  assert.deepEqual(nextSurfaces, { operationId: 4, stage: 'surfaces' })
  assert.equal(hasViewerRevealStage(nextSurfaces, 3, 'controls'), false)
})
