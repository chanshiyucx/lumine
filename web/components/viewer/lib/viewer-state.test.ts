import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createClosedViewerState,
  createDirectViewerState,
  reduceViewerState,
} from './viewer-state'

test('direct entries render open without an entry animation', () => {
  const state = createDirectViewerState(4)

  assert.equal(state.phase, 'open')
  assert.equal(state.entryMode, 'none')
  assert.equal(state.activeIndex, 4)
})

test('a gallery open enters and completes only for the current operation', () => {
  const entering = reduceViewerState(createClosedViewerState(), {
    type: 'open',
    index: 2,
    mode: 'shared',
  })
  const staleCompletion = reduceViewerState(entering, {
    type: 'entry-complete',
    operationId: entering.operationId - 1,
  })
  const completed = reduceViewerState(entering, {
    type: 'entry-complete',
    operationId: entering.operationId,
  })

  assert.equal(staleCompletion, entering)
  assert.equal(completed.phase, 'open')
})

test('closing during entry supersedes the stale entry completion', () => {
  const entering = reduceViewerState(createClosedViewerState(), {
    type: 'open',
    index: 1,
    mode: 'shared',
  })
  const exiting = reduceViewerState(entering, {
    type: 'close',
    mode: 'shared',
  })
  const staleCompletion = reduceViewerState(exiting, {
    type: 'entry-complete',
    operationId: entering.operationId,
  })

  assert.equal(staleCompletion, exiting)
  assert.equal(exiting.phase, 'exiting')
})

test('reopening during exit makes the old exit completion harmless', () => {
  const open = reduceViewerState(createDirectViewerState(0), {
    type: 'close',
    mode: 'fade',
  })
  const reopened = reduceViewerState(open, {
    type: 'open',
    index: 0,
    mode: 'shared',
  })
  const staleCompletion = reduceViewerState(reopened, {
    type: 'exit-complete',
    operationId: open.operationId,
  })

  assert.equal(staleCompletion, reopened)
  assert.equal(reopened.phase, 'entering')
})

test('photo selection is accepted only after entry completes', () => {
  const entering = reduceViewerState(createClosedViewerState(), {
    type: 'open',
    index: 0,
    mode: 'fade',
  })
  const ignored = reduceViewerState(entering, { type: 'select', index: 1 })
  const open = reduceViewerState(entering, {
    type: 'entry-complete',
    operationId: entering.operationId,
  })
  const selected = reduceViewerState(open, { type: 'select', index: 1 })

  assert.equal(ignored, entering)
  assert.equal(selected.activeIndex, 1)
  assert.equal(selected.isZoomed, false)
})
