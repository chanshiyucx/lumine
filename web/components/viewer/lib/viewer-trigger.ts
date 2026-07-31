export const VIEWER_TRIGGER_ATTRIBUTE = 'data-viewer-trigger'

interface TriggerElementLike {
  getAttribute: (name: string) => string | null
  getBoundingClientRect: () => {
    bottom: number
    height: number
    left: number
    right: number
    top: number
    width: number
  }
  isConnected: boolean
}

function escapeAttributeValue(value: string) {
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(value)
  }

  return value.replaceAll(/['\\]/g, '\\$&')
}

export function isUsableViewerTrigger(
  element: TriggerElementLike | null | undefined,
  photoId: string,
  viewport: { height: number; width: number },
) {
  if (
    !element?.isConnected ||
    element.getAttribute(VIEWER_TRIGGER_ATTRIBUTE) !== photoId
  ) {
    return false
  }

  const rect = element.getBoundingClientRect()

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < viewport.height &&
    rect.left < viewport.width
  )
}

export function resolveViewerTrigger(
  photoId: string,
  explicitElement?: HTMLElement | null,
) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null
  }

  const viewport = {
    height: window.innerHeight,
    width: window.innerWidth,
  }

  if (isUsableViewerTrigger(explicitElement, photoId, viewport)) {
    return explicitElement ?? null
  }

  const selector = `[${VIEWER_TRIGGER_ATTRIBUTE}="${escapeAttributeValue(photoId)}"]`
  const liveElement = document.querySelector<HTMLElement>(selector)

  return isUsableViewerTrigger(liveElement, photoId, viewport)
    ? liveElement
    : null
}
