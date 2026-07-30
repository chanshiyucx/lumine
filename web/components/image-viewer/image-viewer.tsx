'use client'

/* eslint-disable @next/next/no-img-element */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
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
import { cn } from '@/lib/style'
import {
  defaultDoubleClickConfig,
  defaultPanningConfig,
  defaultPinchConfig,
  defaultWheelConfig,
} from './constants'
import { DoubleTapRecognizer } from './double-tap'
import type { ImageViewerProps, ImageViewerRef } from './types'

const SCALE_EPSILON = 0.0001
const TRANSFORM_ANIMATION = 'easeOutQuart'

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
  limitToBounds: boolean,
) {
  if (!limitToBounds) {
    return { positionX, positionY }
  }

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

export const ImageViewer = forwardRef<ImageViewerRef, ImageViewerProps>(
  function ImageViewer(
    {
      src,
      alt,
      className,
      width,
      height,
      initialScale = 1,
      minScale = 0.1,
      maxScale = 10,
      wheel = defaultWheelConfig,
      pinch = defaultPinchConfig,
      doubleClick = defaultDoubleClickConfig,
      panning = defaultPanningConfig,
      limitToBounds = true,
      centerOnInit = true,
      smooth = true,
      onLoad,
      onZoomChange,
      onError,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const transformRef = useRef<ReactZoomPanPinchRef | null>(null)
    const imageRef = useRef<HTMLImageElement | null>(null)
    const imageLayoutRef = useRef<ImageLayout | null>(null)
    const pendingLayoutTransformRef = useRef<PendingLayoutTransform | null>(
      null,
    )
    const lastNotifiedPixelScaleRef = useRef<number | null>(null)
    const isOriginalSizeRef = useRef(false)
    const doubleTapRecognizerRef = useRef<DoubleTapRecognizer | null>(null)
    if (!doubleTapRecognizerRef.current) {
      doubleTapRecognizerRef.current = new DoubleTapRecognizer()
    }
    const [minimumRequiredMaxScale, setMinimumRequiredMaxScale] =
      useState(maxScale)
    const [imageLayout, setImageLayout] = useState<ImageLayout | null>(null)

    const interactionConfig = useMemo(
      () => ({
        wheel: { ...defaultWheelConfig, ...wheel },
        pinch: { ...defaultPinchConfig, ...pinch },
        doubleClick: { ...defaultDoubleClickConfig, ...doubleClick },
        panning: { ...defaultPanningConfig, ...panning },
      }),
      [doubleClick, panning, pinch, wheel],
    )
    const effectiveMaxScale = Math.max(maxScale, minimumRequiredMaxScale)

    const measureImageLayout = useCallback(() => {
      const container = containerRef.current
      const image = imageRef.current
      const sourceWidth =
        width && width > 0 ? width : (image?.naturalWidth ?? 0)
      const sourceHeight =
        height && height > 0 ? height : (image?.naturalHeight ?? 0)

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
      setMinimumRequiredMaxScale(Math.max(maxScale, 1 / fitScale))

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
    }, [height, maxScale, src, width])

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
    }, [measureImageLayout, src])

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

      const minimumPixelScale = imageLayout.fitScale * minScale
      const maximumPixelScale = Math.max(imageLayout.fitScale * maxScale, 1)
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
        limitToBounds,
      )

      pendingLayoutTransformRef.current = null
      transform.setTransform(
        position.positionX,
        position.positionY,
        relativeScale,
        0,
      )
    }, [imageLayout, limitToBounds, maxScale, minScale])

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
      [getMetrics, onZoomChange],
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

        const targetScale = clamp(requestedScale, minScale, effectiveMaxScale)
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
          limitToBounds,
        )

        transform.setTransform(
          position.positionX,
          position.positionY,
          targetScale,
          animationTime,
          TRANSFORM_ANIMATION,
        )
      },
      [effectiveMaxScale, limitToBounds, minScale],
    )

    const zoomByFactorAt = useCallback(
      (
        clientX: number,
        clientY: number,
        scaleFactor: number,
        animationTime = 0,
      ) => {
        const currentScale = transformRef.current?.state.scale
        if (currentScale === undefined) {
          return
        }

        setScaleAtPoint(
          clientX,
          clientY,
          currentScale * scaleFactor,
          animationTime,
        )
      },
      [setScaleAtPoint],
    )

    const performDoubleClickAction = useCallback(
      (clientX: number, clientY: number) => {
        if (interactionConfig.doubleClick.disabled) {
          return
        }

        const transform = transformRef.current
        const wrapper = transform?.instance.wrapperComponent
        const metrics = getMetrics(transform)
        if (!transform || !wrapper || !metrics) {
          return
        }

        if (interactionConfig.doubleClick.mode === 'zoom') {
          zoomByFactorAt(
            clientX,
            clientY,
            interactionConfig.doubleClick.step,
            smooth ? interactionConfig.doubleClick.animationTime : 0,
          )
          return
        }

        const targetScale = isOriginalSizeRef.current
          ? Math.max(minScale, Math.min(effectiveMaxScale, 1))
          : Math.max(
              minScale,
              Math.min(effectiveMaxScale, 1 / metrics.fitScale),
            )

        setScaleAtPoint(
          clientX,
          clientY,
          targetScale,
          smooth ? interactionConfig.doubleClick.animationTime : 0,
        )
        isOriginalSizeRef.current = !isOriginalSizeRef.current
      },
      [
        effectiveMaxScale,
        getMetrics,
        interactionConfig.doubleClick,
        minScale,
        setScaleAtPoint,
        smooth,
        zoomByFactorAt,
      ],
    )

    useImperativeHandle(
      ref,
      () => ({
        zoomIn: (animated = false) => {
          const wrapper = transformRef.current?.instance.wrapperComponent
          if (!wrapper) {
            return
          }

          const rect = wrapper.getBoundingClientRect()
          zoomByFactorAt(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
            1 + interactionConfig.wheel.step,
            animated ? 300 : 0,
          )
        },
        zoomOut: (animated = false) => {
          const wrapper = transformRef.current?.instance.wrapperComponent
          if (!wrapper) {
            return
          }

          const rect = wrapper.getBoundingClientRect()
          zoomByFactorAt(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
            1 - interactionConfig.wheel.step,
            animated ? 300 : 0,
          )
        },
        resetView: () => {
          const transform = transformRef.current
          const wrapper = transform?.instance.wrapperComponent
          const content = transform?.instance.contentComponent
          if (!transform || !wrapper || !content) {
            return
          }

          isOriginalSizeRef.current = false
          const position = constrainPosition(
            (wrapper.clientWidth - content.offsetWidth) / 2,
            (wrapper.clientHeight - content.offsetHeight) / 2,
            1,
            wrapper,
            content,
            limitToBounds,
          )
          transform.setTransform(
            position.positionX,
            position.positionY,
            1,
            smooth ? 300 : 0,
            TRANSFORM_ANIMATION,
          )
        },
        getScale: () => getMetrics()?.pixelScale ?? 1,
      }),
      [
        getMetrics,
        interactionConfig.wheel.step,
        limitToBounds,
        smooth,
        zoomByFactorAt,
      ],
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
        if (interactionConfig.wheel.wheelDisabled) {
          return
        }

        zoomByFactorAt(
          event.clientX,
          event.clientY,
          event.deltaY > 0
            ? 1 - interactionConfig.wheel.step
            : 1 + interactionConfig.wheel.step,
        )
      }

      container.addEventListener('wheel', handleWheel, { passive: false })
      return () => {
        container.removeEventListener('wheel', handleWheel)
      }
    }, [interactionConfig.wheel, zoomByFactorAt])

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

    const handleTouchStart = useCallback(
      (event: TouchEvent<HTMLDivElement>) => {
        const touch = event.touches[0]
        doubleTapRecognizerRef.current?.start(
          event.touches.length,
          touch ? { x: touch.clientX, y: touch.clientY } : undefined,
        )
      },
      [],
    )

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
        className={cn(
          'absolute inset-0 h-full w-full select-none [-webkit-touch-callout:none]',
          className,
        )}
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
          initialScale={initialScale}
          minScale={minScale}
          maxScale={effectiveMaxScale}
          wheel={{
            disabled: true,
          }}
          pinch={{
            step: 5,
            disabled: interactionConfig.pinch.disabled,
            allowPanning: false,
          }}
          doubleClick={{ disabled: true }}
          panning={{
            disabled: interactionConfig.panning.disabled,
            velocityDisabled: true,
          }}
          limitToBounds={limitToBounds}
          centerOnInit={centerOnInit}
          centerZoomedOut
          smooth={smooth}
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
  },
)

ImageViewer.displayName = 'ImageViewer'
