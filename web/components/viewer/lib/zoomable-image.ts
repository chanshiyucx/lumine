import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'

export const DOUBLE_CLICK_ANIMATION_TIME = 200
export const INITIAL_SCALE = 1
export const MAX_SCALE = 20
export const MIN_SCALE = 1
export const SCALE_EPSILON = 0.0001
export const TRANSFORM_ANIMATION = 'easeOutQuart'
export const WHEEL_STEP = 0.1
export const ZOOM_STATE_EPSILON = 0.01

export interface ImageLayout {
  contentHeight: number
  contentWidth: number
  fitScale: number
  source: string
  sourceHeight: number
  sourceWidth: number
  viewportHeight: number
  viewportWidth: number
}

export interface PendingLayoutTransform {
  centerOffsetX: number
  centerOffsetY: number
  layout: ImageLayout
  pixelScale: number
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

export function getMaximumRelativeScale(fitScale: number) {
  return Math.max(MAX_SCALE, 1 / fitScale)
}

export function isSameLayout(first: ImageLayout, second: ImageLayout) {
  return (
    first.source === second.source &&
    first.sourceWidth === second.sourceWidth &&
    first.sourceHeight === second.sourceHeight &&
    first.viewportWidth === second.viewportWidth &&
    first.viewportHeight === second.viewportHeight
  )
}

export function constrainPosition(
  positionX: number,
  positionY: number,
  scale: number,
  wrapper: HTMLDivElement,
  content: HTMLDivElement,
) {
  const scaledWidth = content.offsetWidth * scale
  const scaledHeight = content.offsetHeight * scale

  return {
    positionX:
      scaledWidth <= wrapper.clientWidth
        ? (wrapper.clientWidth - scaledWidth) / 2
        : clamp(positionX, wrapper.clientWidth - scaledWidth, 0),
    positionY:
      scaledHeight <= wrapper.clientHeight
        ? (wrapper.clientHeight - scaledHeight) / 2
        : clamp(positionY, wrapper.clientHeight - scaledHeight, 0),
  }
}

export function getImageMetrics(
  transform: ReactZoomPanPinchRef | null,
  layout: ImageLayout | null,
  source: string,
) {
  if (!transform || !layout || layout.source !== source) {
    return null
  }

  return {
    fitScale: layout.fitScale,
    pixelScale: transform.state.scale * layout.fitScale,
    relativeScale: transform.state.scale,
  }
}
