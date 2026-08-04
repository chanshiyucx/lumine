import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type TouchEvent,
} from 'react'
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import { DoubleTapRecognizer } from '../lib/double-tap-recognizer'
import {
  clamp,
  constrainPosition,
  DOUBLE_CLICK_ANIMATION_TIME,
  getImageMetrics,
  getMaximumRelativeScale,
  INITIAL_SCALE,
  isSameLayout,
  MAX_SCALE,
  MIN_SCALE,
  SCALE_EPSILON,
  TRANSFORM_ANIMATION,
  WHEEL_STEP,
  ZOOM_STATE_EPSILON,
  type ImageLayout,
  type PendingLayoutTransform,
} from '../lib/zoomable-image'

interface UseZoomableImageOptions {
  height: number
  onLoad?: () => void
  onZoomChange?: (pixelScale: number, relativeScale: number) => void
  onZoomStateChange?: (isZoomed: boolean) => void
  src: string
  width: number
}

export function useZoomableImage({
  height,
  onLoad,
  onZoomChange,
  onZoomStateChange,
  src,
  width,
}: UseZoomableImageOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const imageLayoutRef = useRef<ImageLayout | null>(null)
  const pendingLayoutTransformRef = useRef<PendingLayoutTransform | null>(null)
  const lastNotifiedPixelScaleRef = useRef<number | null>(null)
  const lastZoomedStateRef = useRef(false)
  const isOriginalSizeRef = useRef(false)
  const [doubleTapRecognizer] = useState(() => new DoubleTapRecognizer())
  const [imageLayout, setImageLayout] = useState<ImageLayout | null>(null)
  const [isZoomed, setIsZoomed] = useState(false)
  const effectiveMaxScale = imageLayout
    ? getMaximumRelativeScale(imageLayout.fitScale)
    : MAX_SCALE

  const measureImageLayout = () => {
    const container = containerRef.current
    const image = imageRef.current
    const sourceWidth = width > 0 ? width : (image?.naturalWidth ?? 0)
    const sourceHeight = height > 0 ? height : (image?.naturalHeight ?? 0)

    if (!container || sourceWidth <= 0 || sourceHeight <= 0) {
      return
    }

    const viewportWidth = container.clientWidth
    const viewportHeight = container.clientHeight
    if (viewportWidth <= 0 || viewportHeight <= 0) {
      return
    }

    const fitScale = Math.min(
      viewportWidth / sourceWidth,
      viewportHeight / sourceHeight,
    )
    const nextLayout: ImageLayout = {
      contentHeight: sourceHeight * fitScale,
      contentWidth: sourceWidth * fitScale,
      fitScale,
      source: src,
      sourceHeight,
      sourceWidth,
      viewportHeight,
      viewportWidth,
    }
    const previousLayout = imageLayoutRef.current

    if (previousLayout && isSameLayout(previousLayout, nextLayout)) {
      return
    }

    const transform = transformRef.current
    if (previousLayout && transform) {
      const currentScale = transform.state.scale
      pendingLayoutTransformRef.current = {
        centerOffsetX:
          transform.state.positionX +
          (previousLayout.contentWidth * currentScale) / 2 -
          previousLayout.viewportWidth / 2,
        centerOffsetY:
          transform.state.positionY +
          (previousLayout.contentHeight * currentScale) / 2 -
          previousLayout.viewportHeight / 2,
        layout: nextLayout,
        pixelScale: currentScale * previousLayout.fitScale,
      }
    } else {
      pendingLayoutTransformRef.current = null
    }

    imageLayoutRef.current = nextLayout
    setImageLayout(nextLayout)
  }
  const measureImageLayoutFromEffect = useEffectEvent(measureImageLayout)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    measureImageLayoutFromEffect()
    const observer = new ResizeObserver(measureImageLayoutFromEffect)
    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const pendingTransform = pendingLayoutTransformRef.current
    const transform = transformRef.current
    const wrapper = transform?.instance.wrapperComponent
    const content = transform?.instance.contentComponent

    if (
      !pendingTransform ||
      pendingTransform.layout !== imageLayout ||
      !transform ||
      !wrapper ||
      !content
    ) {
      return
    }

    const minimumPixelScale = imageLayout.fitScale * MIN_SCALE
    const maximumPixelScale =
      imageLayout.fitScale * getMaximumRelativeScale(imageLayout.fitScale)
    const pixelScale = clamp(
      pendingTransform.pixelScale,
      minimumPixelScale,
      maximumPixelScale,
    )
    const relativeScale = pixelScale / imageLayout.fitScale
    const position = constrainPosition(
      imageLayout.viewportWidth / 2 +
        pendingTransform.centerOffsetX -
        (imageLayout.contentWidth * relativeScale) / 2,
      imageLayout.viewportHeight / 2 +
        pendingTransform.centerOffsetY -
        (imageLayout.contentHeight * relativeScale) / 2,
      relativeScale,
      wrapper,
      content,
    )

    pendingLayoutTransformRef.current = null
    transform.setTransform(
      position.positionX,
      position.positionY,
      relativeScale,
      0,
    )
  }, [imageLayout])

  const getMetrics = (requestedTransform?: ReactZoomPanPinchRef | null) =>
    getImageMetrics(
      requestedTransform ?? transformRef.current,
      imageLayoutRef.current,
      src,
    )

  const notifyZoomChange = (transform: ReactZoomPanPinchRef, force = false) => {
    const metrics = getMetrics(transform)
    if (!metrics) {
      return
    }

    const nextIsZoomed =
      Math.abs(metrics.relativeScale - INITIAL_SCALE) >= ZOOM_STATE_EPSILON
    if (nextIsZoomed !== lastZoomedStateRef.current) {
      lastZoomedStateRef.current = nextIsZoomed
      setIsZoomed(nextIsZoomed)
      onZoomStateChange?.(nextIsZoomed)
    }

    if (
      !force &&
      lastNotifiedPixelScaleRef.current !== null &&
      Math.abs(metrics.pixelScale - lastNotifiedPixelScaleRef.current) <
        SCALE_EPSILON
    ) {
      return
    }

    lastNotifiedPixelScaleRef.current = metrics.pixelScale
    onZoomChange?.(metrics.pixelScale, metrics.relativeScale)
  }

  const setScaleAtPoint = (
    clientX: number,
    clientY: number,
    requestedScale: number,
    animationTime = 0,
  ) => {
    const transform = transformRef.current
    const wrapper = transform?.instance.wrapperComponent
    const content = transform?.instance.contentComponent
    if (!transform || !wrapper || !content) {
      return
    }

    const targetScale = clamp(requestedScale, MIN_SCALE, effectiveMaxScale)
    const currentScale = transform.state.scale
    if (targetScale === currentScale) {
      return
    }

    const wrapperRect = wrapper.getBoundingClientRect()
    const pointerX = clientX - wrapperRect.left
    const pointerY = clientY - wrapperRect.top
    const contentX = (pointerX - transform.state.positionX) / currentScale
    const contentY = (pointerY - transform.state.positionY) / currentScale
    const position = constrainPosition(
      pointerX - contentX * targetScale,
      pointerY - contentY * targetScale,
      targetScale,
      wrapper,
      content,
    )

    transform.setTransform(
      position.positionX,
      position.positionY,
      targetScale,
      animationTime,
      TRANSFORM_ANIMATION,
    )
  }

  const zoomByFactorAt = (
    clientX: number,
    clientY: number,
    scaleFactor: number,
  ) => {
    const currentScale = transformRef.current?.state.scale
    if (currentScale !== undefined) {
      setScaleAtPoint(clientX, clientY, currentScale * scaleFactor)
    }
  }

  const performDoubleClickAction = (clientX: number, clientY: number) => {
    const transform = transformRef.current
    const metrics = getMetrics(transform)
    if (!transform || !metrics) {
      return
    }

    const targetScale = isOriginalSizeRef.current
      ? Math.max(MIN_SCALE, Math.min(effectiveMaxScale, 1))
      : Math.max(MIN_SCALE, Math.min(effectiveMaxScale, 1 / metrics.fitScale))

    setScaleAtPoint(clientX, clientY, targetScale, DOUBLE_CLICK_ANIMATION_TIME)
    isOriginalSizeRef.current = !isOriginalSizeRef.current
  }

  useEffect(() => {
    isOriginalSizeRef.current = false
    lastNotifiedPixelScaleRef.current = null
    doubleTapRecognizer.reset()
  }, [doubleTapRecognizer, src])

  const handleWheel = useEffectEvent((event: WheelEvent) => {
    event.preventDefault()
    zoomByFactorAt(
      event.clientX,
      event.clientY,
      event.deltaY > 0 ? 1 - WHEEL_STEP : 1 + WHEEL_STEP,
    )
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [])

  const handleImageLoad = async () => {
    measureImageLayout()

    const transform = transformRef.current
    if (transform) {
      notifyZoomChange(transform, true)
    }
    try {
      await imageRef.current?.decode()
    } catch {
      // The load event already proved the resource is renderable. Some browsers
      // reject decode() when the element changes state during the same frame.
    }

    onLoad?.()
  }

  const handleMouseDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    performDoubleClickAction(event.clientX, event.clientY)
  }

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    doubleTapRecognizer.start(
      event.touches.length,
      touch ? { x: touch.clientX, y: touch.clientY } : undefined,
    )
  }

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    doubleTapRecognizer.move(
      event.touches.length,
      touch ? { x: touch.clientX, y: touch.clientY } : undefined,
    )
  }

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0]
    if (
      doubleTapRecognizer.end(
        event.touches.length,
        touch ? { x: touch.clientX, y: touch.clientY } : undefined,
      ) &&
      touch
    ) {
      performDoubleClickAction(touch.clientX, touch.clientY)
    }
  }

  return {
    containerRef,
    effectiveMaxScale,
    handleImageLoad,
    handleMouseDoubleClick,
    handleTouchCancel: () => doubleTapRecognizer.reset(),
    handleTouchEnd,
    handleTouchMove,
    handleTouchStart,
    imageLayout,
    imageRef,
    isZoomed,
    notifyZoomChange,
    transformRef,
  }
}
