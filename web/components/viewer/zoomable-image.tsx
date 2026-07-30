/* eslint-disable @next/next/no-img-element */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type TouchEvent,
} from 'react'
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch'
import { useMobile } from '@/hooks/use-mobile'
import { DoubleTapRecognizer } from './lib/double-tap-recognizer'

const DOUBLE_CLICK_ANIMATION_TIME = 200
const INITIAL_SCALE = 1
const MAX_SCALE = 20
const MIN_SCALE = 1
const SCALE_EPSILON = 0.0001
const TRANSFORM_ANIMATION = 'easeOutQuart'
const WHEEL_STEP = 0.1
const ZOOM_STATE_EPSILON = 0.01

interface ZoomableImageProps {
  src: string
  alt: string
  width: number
  height: number
  onLoad?: () => void
  /** Reports source-pixel scale first and fit-relative scale second. */
  onZoomChange?: (pixelScale: number, relativeScale: number) => void
  onZoomStateChange?: (isZoomed: boolean) => void
  onError?: (error: Error) => void
}

interface ImageMetrics {
  fitScale: number
  pixelScale: number
  relativeScale: number
}

interface ImageLayout {
  contentHeight: number
  contentWidth: number
  fitScale: number
  source: string
  sourceHeight: number
  sourceWidth: number
  viewportHeight: number
  viewportWidth: number
}

interface PendingLayoutTransform {
  centerOffsetX: number
  centerOffsetY: number
  layout: ImageLayout
  pixelScale: number
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}

function getMaximumRelativeScale(fitScale: number) {
  return Math.max(MAX_SCALE, 1 / fitScale)
}

function isSameLayout(first: ImageLayout, second: ImageLayout) {
  return (
    first.source === second.source &&
    first.sourceWidth === second.sourceWidth &&
    first.sourceHeight === second.sourceHeight &&
    first.viewportWidth === second.viewportWidth &&
    first.viewportHeight === second.viewportHeight
  )
}

function constrainPosition(
  positionX: number,
  positionY: number,
  scale: number,
  wrapper: HTMLDivElement,
  content: HTMLDivElement,
) {
  const scaledWidth = content.offsetWidth * scale
  const scaledHeight = content.offsetHeight * scale
  const boundedX =
    scaledWidth <= wrapper.clientWidth
      ? (wrapper.clientWidth - scaledWidth) / 2
      : clamp(positionX, wrapper.clientWidth - scaledWidth, 0)
  const boundedY =
    scaledHeight <= wrapper.clientHeight
      ? (wrapper.clientHeight - scaledHeight) / 2
      : clamp(positionY, wrapper.clientHeight - scaledHeight, 0)

  return {
    positionX: boundedX,
    positionY: boundedY,
  }
}

export function ZoomableImage({
  src,
  alt,
  width,
  height,
  onLoad,
  onZoomChange,
  onZoomStateChange,
  onError,
}: ZoomableImageProps) {
  const isMobile = useMobile()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const imageLayoutRef = useRef<ImageLayout | null>(null)
  const pendingLayoutTransformRef = useRef<PendingLayoutTransform | null>(null)
  const lastNotifiedPixelScaleRef = useRef<number | null>(null)
  const lastZoomedStateRef = useRef(false)
  const isOriginalSizeRef = useRef(false)
  const doubleTapRecognizerRef = useRef<DoubleTapRecognizer | null>(null)
  if (!doubleTapRecognizerRef.current) {
    doubleTapRecognizerRef.current = new DoubleTapRecognizer()
  }
  const [imageLayout, setImageLayout] = useState<ImageLayout | null>(null)
  const [isZoomed, setIsZoomed] = useState(false)

  const effectiveMaxScale = imageLayout
    ? getMaximumRelativeScale(imageLayout.fitScale)
    : MAX_SCALE

  const measureImageLayout = useCallback(() => {
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
  }, [height, src, width])

  useLayoutEffect(() => {
    imageLayoutRef.current = null
    pendingLayoutTransformRef.current = null
    setImageLayout(null)
  }, [src])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    measureImageLayout()
    const observer = new ResizeObserver(measureImageLayout)
    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [measureImageLayout])

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

  const getMetrics = useCallback(
    (transform = transformRef.current): ImageMetrics | null => {
      const layout = imageLayoutRef.current

      if (!transform || !layout || layout.source !== src) {
        return null
      }

      return {
        fitScale: layout.fitScale,
        pixelScale: transform.state.scale * layout.fitScale,
        relativeScale: transform.state.scale,
      }
    },
    [src],
  )

  const notifyZoomChange = useCallback(
    (transform: ReactZoomPanPinchRef, force = false) => {
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
    },
    [getMetrics, onZoomChange, onZoomStateChange],
  )

  const setScaleAtPoint = useCallback(
    (
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
    },
    [effectiveMaxScale],
  )

  const zoomByFactorAt = useCallback(
    (clientX: number, clientY: number, scaleFactor: number) => {
      const currentScale = transformRef.current?.state.scale
      if (currentScale === undefined) {
        return
      }

      setScaleAtPoint(clientX, clientY, currentScale * scaleFactor)
    },
    [setScaleAtPoint],
  )

  const performDoubleClickAction = useCallback(
    (clientX: number, clientY: number) => {
      const transform = transformRef.current
      const metrics = getMetrics(transform)
      if (!transform || !metrics) {
        return
      }

      const targetScale = isOriginalSizeRef.current
        ? Math.max(MIN_SCALE, Math.min(effectiveMaxScale, 1))
        : Math.max(MIN_SCALE, Math.min(effectiveMaxScale, 1 / metrics.fitScale))

      setScaleAtPoint(
        clientX,
        clientY,
        targetScale,
        DOUBLE_CLICK_ANIMATION_TIME,
      )
      isOriginalSizeRef.current = !isOriginalSizeRef.current
    },
    [effectiveMaxScale, getMetrics, setScaleAtPoint],
  )

  useEffect(() => {
    isOriginalSizeRef.current = false
    lastNotifiedPixelScaleRef.current = null
    doubleTapRecognizerRef.current?.reset()
  }, [src])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      zoomByFactorAt(
        event.clientX,
        event.clientY,
        event.deltaY > 0 ? 1 - WHEEL_STEP : 1 + WHEEL_STEP,
      )
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [zoomByFactorAt])

  const handleImageLoad = useCallback(() => {
    measureImageLayout()

    const transform = transformRef.current
    if (transform) {
      notifyZoomChange(transform, true)
    }
    onLoad?.()
  }, [measureImageLayout, notifyZoomChange, onLoad])

  const handleMouseDoubleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      performDoubleClickAction(event.clientX, event.clientY)
    },
    [performDoubleClickAction],
  )

  const handleTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    doubleTapRecognizerRef.current?.start(
      event.touches.length,
      touch ? { x: touch.clientX, y: touch.clientY } : undefined,
    )
  }, [])

  const handleTouchMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    doubleTapRecognizerRef.current?.move(
      event.touches.length,
      touch ? { x: touch.clientX, y: touch.clientY } : undefined,
    )
  }, [])

  const handleTouchEnd = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      const touch = event.changedTouches[0]
      if (
        doubleTapRecognizerRef.current?.end(
          event.touches.length,
          touch ? { x: touch.clientX, y: touch.clientY } : undefined,
        ) &&
        touch
      ) {
        performDoubleClickAction(touch.clientX, touch.clientY)
      }
    },
    [performDoubleClickAction],
  )

  const handleTouchCancel = useCallback(() => {
    doubleTapRecognizerRef.current?.reset()
  }, [])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full select-none [-webkit-touch-callout:none]"
      onDoubleClick={handleMouseDoubleClick}
      onContextMenu={(event) => event.preventDefault()}
      onTouchStartCapture={handleTouchStart}
      onTouchMoveCapture={handleTouchMove}
      onTouchEndCapture={handleTouchEnd}
      onTouchCancelCapture={handleTouchCancel}
    >
      <TransformWrapper
        key={src}
        ref={transformRef}
        initialScale={INITIAL_SCALE}
        minScale={MIN_SCALE}
        maxScale={effectiveMaxScale}
        wheel={{
          disabled: true,
        }}
        pinch={{
          step: 5,
          disabled: false,
          allowPanning: false,
        }}
        doubleClick={{ disabled: true }}
        panning={{
          disabled: isMobile && !isZoomed,
          velocityDisabled: true,
        }}
        limitToBounds
        centerOnInit
        centerZoomedOut
        smooth
        autoAlignment={{
          sizeX: 0,
          sizeY: 0,
          velocityAlignmentTime: 0.2,
        }}
        velocityAnimation={{
          sensitivityTouch: 1,
          sensitivityMouse: 1,
          animationTime: 0.2,
        }}
        onInit={(transform) => notifyZoomChange(transform, true)}
        onTransform={(transform) => notifyZoomChange(transform)}
      >
        <TransformComponent
          wrapperClass="!absolute !inset-0 !h-full !w-full"
          contentClass="shrink-0"
          wrapperStyle={{ touchAction: 'none' }}
          contentStyle={{
            width: imageLayout?.contentWidth ?? '100%',
            height: imageLayout?.contentHeight ?? '100%',
          }}
        >
          <img
            ref={imageRef}
            src={src}
            alt={alt}
            className="block h-full w-full object-contain"
            draggable={false}
            loading="eager"
            decoding="async"
            onLoad={handleImageLoad}
            onError={() => onError?.(new Error('Failed to load image'))}
          />
        </TransformComponent>
      </TransformWrapper>
    </div>
  )
}
