// Set on gallery cards in components/gallery/photo-masonry-item.tsx.
const VIEWER_TRIGGER_ATTRIBUTE = 'data-viewer-trigger'

function isUsableViewerTrigger(
  element: HTMLElement | null | undefined,
  photoId: string,
  viewport: { height: number; width: number },
): element is HTMLElement {
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

// Called only from browser event paths (open, close, popstate).
export function resolveViewerTrigger(
  photoId: string,
  explicitElement?: HTMLElement | null,
) {
  const viewport = {
    height: window.innerHeight,
    width: window.innerWidth,
  }

  if (isUsableViewerTrigger(explicitElement, photoId, viewport)) {
    return explicitElement
  }

  const selector = `[${VIEWER_TRIGGER_ATTRIBUTE}="${CSS.escape(photoId)}"]`
  const liveElement = document.querySelector<HTMLElement>(selector)

  return isUsableViewerTrigger(liveElement, photoId, viewport)
    ? liveElement
    : null
}
