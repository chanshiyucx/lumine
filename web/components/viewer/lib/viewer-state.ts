export type ViewerPhase = 'closed' | 'entering' | 'open' | 'exiting'
export type ViewerEntryMode = 'none' | 'fade' | 'shared'
export type ViewerExitMode = 'fade' | 'shared'

export interface ViewerState {
  activeIndex: number | null
  entryMode: ViewerEntryMode
  exitMode: ViewerExitMode | null
  isZoomed: boolean
  operationId: number
  phase: ViewerPhase
  triggerElement: HTMLElement | null
}

export type ViewerAction =
  | {
      type: 'open'
      index: number
      mode: ViewerEntryMode
      triggerElement?: HTMLElement | null
    }
  | { type: 'select'; index: number }
  | { type: 'set-zoomed'; isZoomed: boolean }
  | {
      type: 'close'
      mode: ViewerExitMode
      triggerElement?: HTMLElement | null
    }
  | { type: 'entry-complete'; operationId: number }
  | { type: 'exit-complete'; operationId: number }

export function createClosedViewerState(): ViewerState {
  return {
    activeIndex: null,
    entryMode: 'none',
    exitMode: null,
    isZoomed: false,
    operationId: 0,
    phase: 'closed',
    triggerElement: null,
  }
}

export function createDirectViewerState(index: number): ViewerState {
  return {
    activeIndex: index,
    entryMode: 'none',
    exitMode: null,
    isZoomed: false,
    operationId: 0,
    phase: 'open',
    triggerElement: null,
  }
}

export function reduceViewerState(
  state: ViewerState,
  action: ViewerAction,
): ViewerState {
  switch (action.type) {
    case 'open': {
      const operationId = state.operationId + 1

      return {
        activeIndex: action.index,
        entryMode: action.mode,
        exitMode: null,
        isZoomed: false,
        operationId,
        phase: action.mode === 'none' ? 'open' : 'entering',
        triggerElement: action.triggerElement ?? null,
      }
    }

    case 'select': {
      if (state.phase !== 'open') {
        return state
      }

      return {
        ...state,
        activeIndex: action.index,
        entryMode: 'none',
        exitMode: null,
        isZoomed: false,
        triggerElement: null,
      }
    }

    case 'set-zoomed': {
      if (state.phase === 'closed' || state.isZoomed === action.isZoomed) {
        return state
      }

      return {
        ...state,
        isZoomed: action.isZoomed,
      }
    }

    case 'close': {
      if (state.phase === 'closed' || state.phase === 'exiting') {
        return state
      }

      return {
        ...state,
        entryMode: 'none',
        exitMode: action.mode,
        operationId: state.operationId + 1,
        phase: 'exiting',
        triggerElement: action.triggerElement ?? null,
      }
    }

    case 'entry-complete': {
      if (
        state.phase !== 'entering' ||
        state.operationId !== action.operationId
      ) {
        return state
      }

      return {
        ...state,
        entryMode: 'none',
        phase: 'open',
      }
    }

    case 'exit-complete': {
      if (
        state.phase !== 'exiting' ||
        state.operationId !== action.operationId
      ) {
        return state
      }

      return {
        activeIndex: null,
        entryMode: 'none',
        exitMode: null,
        isZoomed: false,
        operationId: state.operationId,
        phase: 'closed',
        triggerElement: null,
      }
    }
  }
}
