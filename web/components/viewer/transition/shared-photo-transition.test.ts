import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createClosedViewerState,
  createDirectViewerState,
  reduceViewerState,
} from '../lib/viewer-state'
import { resolveSharedPhotoTransition } from './shared-photo-transition'

const triggerElement = {} as HTMLElement

test('resolves a shared entry into the transition module interface', () => {
  const state = reduceViewerState(createClosedViewerState(), {
    type: 'open',
    index: 2,
    mode: 'shared',
    triggerElement,
  })

  assert.deepEqual(resolveSharedPhotoTransition(state), {
    operationId: state.operationId,
    phase: 'entering',
    sourceElement: triggerElement,
  })
})

test('resolves a shared exit into the transition module interface', () => {
  const state = reduceViewerState(createDirectViewerState(2), {
    type: 'close',
    mode: 'shared',
    triggerElement,
  })

  assert.deepEqual(resolveSharedPhotoTransition(state), {
    operationId: state.operationId,
    phase: 'exiting',
    sourceElement: triggerElement,
  })
})

test('keeps closed, open, and fade states outside the shared transition module', () => {
  const closed = createClosedViewerState()
  const open = createDirectViewerState(2)
  const fadeEntry = reduceViewerState(closed, {
    type: 'open',
    index: 2,
    mode: 'fade',
  })

  assert.equal(resolveSharedPhotoTransition(closed), null)
  assert.equal(resolveSharedPhotoTransition(open), null)
  assert.equal(resolveSharedPhotoTransition(fadeEntry), null)
})
