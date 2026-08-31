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

export type PendingLayoutTransform =
  | {
      layout: ImageLayout
      mode: 'fit'
    }
  | {
      centerOffsetX: number
      centerOffsetY: number
      layout: ImageLayout
      mode: 'zoom'
      pixelScale: number
    }

export interface PositionBounds {
  contentHeight: number
  contentWidth: number
  viewportHeight: number
  viewportWidth: number
}

export interface TransformState {
  positionX: number
  positionY: number
  scale: number
}

interface CalculateImageLayoutOptions {
  source: string
  sourceHeight: number
  sourceWidth: number
  viewportHeight: number
  viewportWidth: number
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

export function getMaximumRelativeScale(fitScale: number) {
  return Math.max(MAX_SCALE, 1 / fitScale)
}

export function calculateImageLayout({
  source,
  sourceHeight,
  sourceWidth,
  viewportHeight,
  viewportWidth,
}: CalculateImageLayoutOptions): ImageLayout | null {
  if (
    sourceHeight <= 0 ||
    sourceWidth <= 0 ||
    viewportHeight <= 0 ||
    viewportWidth <= 0
  ) {
    return null
  }

  const fitScale = Math.min(
    viewportWidth / sourceWidth,
    viewportHeight / sourceHeight,
  )

  return {
    contentHeight: sourceHeight * fitScale,
    contentWidth: sourceWidth * fitScale,
    fitScale,
    source,
    sourceHeight,
    sourceWidth,
    viewportHeight,
    viewportWidth,
  }
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
  bounds: PositionBounds,
) {
  const scaledWidth = bounds.contentWidth * scale
  const scaledHeight = bounds.contentHeight * scale

  return {
    positionX:
      scaledWidth <= bounds.viewportWidth
        ? (bounds.viewportWidth - scaledWidth) / 2
        : clamp(positionX, bounds.viewportWidth - scaledWidth, 0),
    positionY:
      scaledHeight <= bounds.viewportHeight
        ? (bounds.viewportHeight - scaledHeight) / 2
        : clamp(positionY, bounds.viewportHeight - scaledHeight, 0),
  }
}

export function preserveLayoutTransform(
  previousLayout: ImageLayout,
  nextLayout: ImageLayout,
  transform: TransformState,
): PendingLayoutTransform {
  if (Math.abs(transform.scale - INITIAL_SCALE) < ZOOM_STATE_EPSILON) {
    return { layout: nextLayout, mode: 'fit' }
  }

  return {
    centerOffsetX:
      transform.positionX +
      (previousLayout.contentWidth * transform.scale) / 2 -
      previousLayout.viewportWidth / 2,
    centerOffsetY:
      transform.positionY +
      (previousLayout.contentHeight * transform.scale) / 2 -
      previousLayout.viewportHeight / 2,
    layout: nextLayout,
    mode: 'zoom',
    pixelScale: transform.scale * previousLayout.fitScale,
  }
}

export function resolveLayoutTransform(
  pendingTransform: PendingLayoutTransform,
  layout: ImageLayout,
): TransformState {
  if (pendingTransform.mode === 'fit') {
    return {
      positionX: (layout.viewportWidth - layout.contentWidth) / 2,
      positionY: (layout.viewportHeight - layout.contentHeight) / 2,
      scale: INITIAL_SCALE,
    }
  }

  const minimumPixelScale = layout.fitScale * MIN_SCALE
  const maximumPixelScale =
    layout.fitScale * getMaximumRelativeScale(layout.fitScale)
  const pixelScale = clamp(
    pendingTransform.pixelScale,
    minimumPixelScale,
    maximumPixelScale,
  )
  const scale = pixelScale / layout.fitScale
  const position = constrainPosition(
    layout.viewportWidth / 2 +
      pendingTransform.centerOffsetX -
      (layout.contentWidth * scale) / 2,
    layout.viewportHeight / 2 +
      pendingTransform.centerOffsetY -
      (layout.contentHeight * scale) / 2,
    scale,
    {
      contentHeight: Math.round(layout.contentHeight),
      contentWidth: Math.round(layout.contentWidth),
      viewportHeight: layout.viewportHeight,
      viewportWidth: layout.viewportWidth,
    },
  )

  return { ...position, scale }
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
