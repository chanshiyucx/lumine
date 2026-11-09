import { fitWithinBounds } from '@/lib/math'

interface MediaSize {
  height: number
  width: number
}

interface RectLike {
  height: number
  left: number
  top: number
  width: number
}

export interface ViewerFrame extends RectLike {
  borderRadius: number
}

export interface ProjectedViewerFrame extends ViewerFrame {
  rotate: number
}

export interface ViewerFrameTransform {
  scaleX: number
  scaleY: number
  x: number
  y: number
}

export interface ViewerTransformSnapshot {
  borderRadius: number
  rotate: number
  scale: number
  translateX: number
  translateY: number
}

export function fitMediaFrame(media: MediaSize, bounds: RectLike): ViewerFrame {
  const aspectRatio =
    media.width > 0 && media.height > 0 ? media.width / media.height : 1
  const { width, height } = fitWithinBounds(aspectRatio, bounds)

  return {
    borderRadius: 0,
    height,
    left: bounds.left + (bounds.width - width) / 2,
    top: bounds.top + (bounds.height - height) / 2,
    width,
  }
}

export function getFrameTransform(
  from: RectLike,
  to: RectLike,
): ViewerFrameTransform {
  return {
    scaleX: to.width > 0 ? from.width / to.width : 1,
    scaleY: to.height > 0 ? from.height / to.height : 1,
    x: from.left - to.left,
    y: from.top - to.top,
  }
}

// The mobile stage scales and rotates around this point while dragged to dismiss.
const DISMISS_ORIGIN_PERCENT = { x: 50, y: 18 }

export const DISMISS_TRANSFORM_ORIGIN = `${DISMISS_ORIGIN_PERCENT.x}% ${DISMISS_ORIGIN_PERCENT.y}%`

/** Where the photo sits on screen at the end of a mobile dismiss gesture. */
export function projectDismissedFrame(
  media: MediaSize,
  stage: RectLike,
  viewport: RectLike,
  snapshot: ViewerTransformSnapshot,
): ProjectedViewerFrame {
  const frame = fitMediaFrame(media, stage)
  const originX =
    viewport.left + (viewport.width * DISMISS_ORIGIN_PERCENT.x) / 100
  const originY =
    viewport.top + (viewport.height * DISMISS_ORIGIN_PERCENT.y) / 100

  return {
    borderRadius: snapshot.borderRadius,
    height: frame.height * snapshot.scale,
    left:
      originX + (frame.left - originX) * snapshot.scale + snapshot.translateX,
    rotate: snapshot.rotate,
    top: originY + (frame.top - originY) * snapshot.scale + snapshot.translateY,
    width: frame.width * snapshot.scale,
  }
}
