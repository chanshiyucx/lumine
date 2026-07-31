export interface RectLike {
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

export function fitMediaFrame(
  media: { height: number; width: number },
  bounds: RectLike,
): ViewerFrame {
  const aspectRatio =
    media.width > 0 && media.height > 0 ? media.width / media.height : 1
  let width = bounds.width
  let height = width / aspectRatio

  if (height > bounds.height) {
    height = bounds.height
    width = height * aspectRatio
  }

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

export function projectViewerFrame(
  frame: ViewerFrame,
  viewport: RectLike,
  snapshot: {
    borderRadius: number
    rotate: number
    scale: number
    translateX: number
    translateY: number
  },
): ProjectedViewerFrame {
  const originX = viewport.left + viewport.width * 0.5
  const originY = viewport.top + viewport.height * 0.18

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
