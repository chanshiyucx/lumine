import { clamp } from '@/lib/math'

export function getMobileGestureMetrics(viewportHeight: number) {
  return {
    dismissThreshold: clamp(viewportHeight * 0.18, 120, 180),
    dismissTravel: viewportHeight + 160,
    inspectorTravel: clamp(viewportHeight * 0.28, 180, 280),
  }
}

export function shouldOpenInspector({
  directionY,
  progress,
  velocityY,
}: {
  directionY: number
  progress: number
  velocityY: number
}) {
  return progress > 0.42 || (directionY < 0 && velocityY > 0.2)
}

export function getInspectorSettleVelocity(open: boolean, velocity: number) {
  const clampedVelocity = clamp(velocity, -2.2, 2.2)

  return open ? Math.max(clampedVelocity, 0) : Math.min(clampedVelocity, 0)
}

export function getInspectorPresentation(progress: number) {
  const hiddenProgress = 1 - progress

  return {
    borderRadius: progress * 14,
    chromeOpacity: 1 - progress * 0.92,
    panelOpacity: clamp(progress * 1.6, 0, 1),
    panelY: `calc(${hiddenProgress * 100}% + ${hiddenProgress * 28}px)`,
    railOpacity: hiddenProgress,
    scaleReduction: progress * 0.015,
    stageLift: progress * 12,
  }
}

export function getDismissDragX(
  movementX: number,
  movementY: number,
  dismissTravel: number,
  viewportWidth: number,
) {
  const ratio = clamp(movementY / Math.max(dismissTravel, 1), 0, 1)
  const maxOffset = viewportWidth * 0.2

  return clamp(movementX * (0.18 + ratio * 0.1), -maxOffset, maxOffset)
}

export function shouldDismissViewer({
  distance,
  directionY,
  threshold,
  velocityY,
}: {
  distance: number
  directionY: number
  threshold: number
  velocityY: number
}) {
  return (
    distance > threshold ||
    (directionY > 0 && velocityY > 0.65 && distance > 36)
  )
}

export function getDismissThrowTarget({
  currentX,
  currentY,
  directionX,
  velocityX,
  velocityY,
  viewport,
}: {
  currentX: number
  currentY: number
  directionX: number
  velocityX: number
  velocityY: number
  viewport: { height: number; width: number }
}) {
  const throwVelocityX = velocityX * (directionX === 0 ? 1 : directionX)
  const throwVelocityY = Math.max(velocityY, 0.72)
  const maxOffsetX = viewport.width * 0.22

  return {
    x: clamp(
      currentX + throwVelocityX * viewport.width * 0.1,
      -maxOffsetX,
      maxOffsetX,
    ),
    // A drag can already be past the cap, so the throw only ever moves downward.
    y: Math.max(
      Math.min(
        currentY + viewport.height * (0.08 + throwVelocityY * 0.04),
        viewport.height * 0.42,
      ),
      currentY + 40,
    ),
  }
}

export function getDismissPresentation(
  translateX: number,
  translateY: number,
  dismissTravel: number,
  viewportWidth: number,
) {
  const ratio = clamp(translateY / Math.max(dismissTravel, 1), 0, 1)
  const eased = 1 - (1 - ratio) ** 2

  return {
    backdropOpacity: clamp(1 - eased * 0.86, 0.08, 1),
    borderRadius: eased * 20,
    chromeOpacity: clamp(1 - eased * 0.58, 0, 1),
    rotate: clamp((translateX / Math.max(viewportWidth, 1)) * 5, -3, 3),
    scale: clamp(1 - eased * 0.13, 0.87, 1),
  }
}
