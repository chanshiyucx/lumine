const VIEWER_HISTORY_KEY = '__lumineViewer'

export interface ViewerHistoryMarker {
  baseUrl: string
  sessionId: string
}

export function getHistoryMarker(): ViewerHistoryMarker | null {
  const state = window.history.state as
    Record<string, unknown> | null | undefined
  const marker = state?.[VIEWER_HISTORY_KEY]

  if (
    !marker ||
    typeof marker !== 'object' ||
    !('baseUrl' in marker) ||
    !('sessionId' in marker) ||
    typeof marker.baseUrl !== 'string' ||
    typeof marker.sessionId !== 'string'
  ) {
    return null
  }

  return {
    baseUrl: marker.baseUrl,
    sessionId: marker.sessionId,
  }
}

export function withHistoryMarker(marker: ViewerHistoryMarker) {
  return {
    ...(window.history.state ?? {}),
    [VIEWER_HISTORY_KEY]: marker,
  }
}

export function withoutHistoryMarker() {
  const state = {
    ...(window.history.state ?? {}),
  } as Record<string, unknown>

  delete state[VIEWER_HISTORY_KEY]

  return state
}
