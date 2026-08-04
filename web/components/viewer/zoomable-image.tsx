import Image from 'next/image'
import type { CSSProperties } from 'react'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { useMobile } from '@/hooks/use-mobile'
import { useZoomableImage } from './hooks/use-zoomable-image'
import { INITIAL_SCALE, MIN_SCALE } from './lib/zoomable-image'

const TRANSFORM_WRAPPER_STYLE = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  touchAction: 'none',
} satisfies CSSProperties

interface ZoomableImageProps {
  alt: string
  height: number
  onError?: (error: Error) => void
  onLoad?: () => void
  /** Reports source-pixel scale first and fit-relative scale second. */
  onZoomChange?: (pixelScale: number, relativeScale: number) => void
  onZoomStateChange?: (isZoomed: boolean) => void
  src: string
  width: number
}

export function ZoomableImage({
  alt,
  height,
  onError,
  onLoad,
  onZoomChange,
  onZoomStateChange,
  src,
  width,
}: ZoomableImageProps) {
  const isMobile = useMobile()
  const {
    containerRef,
    effectiveMaxScale,
    handleImageLoad,
    handleMouseDoubleClick,
    handleTouchCancel,
    handleTouchEnd,
    handleTouchMove,
    handleTouchStart,
    imageLayout,
    imageRef,
    isZoomed,
    notifyZoomChange,
    transformRef,
  } = useZoomableImage({
    height,
    onLoad,
    onZoomChange,
    onZoomStateChange,
    src,
    width,
  })

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 select-none [-webkit-touch-callout:none]"
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
        wheel={{ disabled: true }}
        pinch={{ step: 5, disabled: false, allowPanning: false }}
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
          wrapperStyle={TRANSFORM_WRAPPER_STYLE}
          contentStyle={{
            width: imageLayout?.contentWidth ?? '100%',
            height: imageLayout?.contentHeight ?? '100%',
          }}
        >
          <Image
            ref={imageRef}
            src={src}
            alt={alt}
            width={width}
            height={height}
            className="block size-full object-contain"
            draggable={false}
            loading="eager"
            decoding="async"
            unoptimized
            onLoad={handleImageLoad}
            onError={() => onError?.(new Error('Failed to load image'))}
          />
        </TransformComponent>
      </TransformWrapper>
    </div>
  )
}
