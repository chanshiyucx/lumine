const SHEET_DISMISS_DISTANCE = 72
const SHEET_DISMISS_VELOCITY = 0.6

export function shouldPreviewClusterOnTouch({
  canHover,
  expansionZoom,
  maxClusterZoom,
}: {
  canHover: boolean
  expansionZoom: number
  maxClusterZoom: number
}) {
  return !canHover && expansionZoom > maxClusterZoom
}

export function shouldDismissMobilePreview({
  distance,
  elapsedMs,
}: {
  distance: number
  elapsedMs: number
}) {
  const safeElapsedMs = Math.max(elapsedMs, 1)
  return (
    distance >= SHEET_DISMISS_DISTANCE ||
    distance / safeElapsedMs >= SHEET_DISMISS_VELOCITY
  )
}
