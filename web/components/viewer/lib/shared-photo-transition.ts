import type { ViewerState } from './viewer-state'

export interface ActiveSharedPhotoTransition {
  operationId: number
  phase: Extract<ViewerState['phase'], 'entering' | 'exiting'>
  sourceElement: HTMLElement
}

export function resolveSharedPhotoTransition(
  state: ViewerState,
): ActiveSharedPhotoTransition | null {
  const isSharedEntry =
    state.phase === 'entering' && state.entryMode === 'shared'
  const isSharedExit = state.phase === 'exiting' && state.exitMode === 'shared'

  if ((!isSharedEntry && !isSharedExit) || state.triggerElement === null) {
    return null
  }

  return {
    operationId: state.operationId,
    phase: isSharedEntry ? 'entering' : 'exiting',
    sourceElement: state.triggerElement,
  }
}
