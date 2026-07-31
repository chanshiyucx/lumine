export type ViewerRevealStage = 'hidden' | 'surfaces' | 'controls'

export interface ViewerRevealState {
  operationId: number
  stage: ViewerRevealStage
}

const REVEAL_STAGE_ORDER: Record<ViewerRevealStage, number> = {
  hidden: 0,
  surfaces: 1,
  controls: 2,
}

export function createViewerRevealState(
  operationId: number,
  stage: ViewerRevealStage,
): ViewerRevealState {
  return { operationId, stage }
}

export function advanceViewerRevealState(
  state: ViewerRevealState,
  operationId: number,
  stage: ViewerRevealStage,
): ViewerRevealState {
  if (
    operationId < state.operationId ||
    (operationId === state.operationId &&
      REVEAL_STAGE_ORDER[stage] <= REVEAL_STAGE_ORDER[state.stage])
  ) {
    return state
  }

  return { operationId, stage }
}

export function hasViewerRevealStage(
  state: ViewerRevealState,
  operationId: number,
  stage: ViewerRevealStage,
) {
  return (
    state.operationId === operationId &&
    REVEAL_STAGE_ORDER[state.stage] >= REVEAL_STAGE_ORDER[stage]
  )
}
