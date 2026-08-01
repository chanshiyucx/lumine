export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

export function getMobileGestureMetrics(viewportHeight: number) {
  return {
    dismissThreshold: clamp(viewportHeight * 0.18, 120, 180),
    dismissTravel: viewportHeight + 160,
    inspectorTravel: clamp(viewportHeight * 0.28, 180, 280),
  }
}

export function getInspectorSettleVelocity(open: boolean, velocity: number) {
  const clampedVelocity = clamp(velocity, -2.2, 2.2)

  return open ? Math.max(clampedVelocity, 0) : Math.min(clampedVelocity, 0)
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

export function getDismissPresentation(
  translateX: number,
  translateY: number,
  dismissTravel: number,
  viewportWidth: number,
) {
  const ratio = clamp(translateY / Math.max(dismissTravel, 1), 0, 1)
  const eased = 1 - Math.pow(1 - ratio, 2)

  return {
    backdropOpacity: clamp(1 - eased * 0.86, 0.08, 1),
    borderRadius: eased * 20,
    chromeOpacity: clamp(1 - eased * 0.58, 0, 1),
    rotate: clamp((translateX / Math.max(viewportWidth, 1)) * 5, -3, 3),
    scale: clamp(1 - eased * 0.13, 0.87, 1),
  }
}
