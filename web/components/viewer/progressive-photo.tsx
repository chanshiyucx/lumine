import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import type { Photo } from '@/lib/photo'
import { cn } from '@/lib/style'
import { useProgressivePhoto } from './hooks/use-progressive-photo'
import { LoadingIndicator } from './loading-indicator'
import { ZoomableImage } from './zoomable-image'

interface ProgressivePhotoProps {
  photo: Photo
  isActive: boolean
  loadDelayMs?: number
  onZoomStateChange?: (isZoomed: boolean) => void
  shouldMountInteractiveImage?: boolean
}

const SCALE_INDICATOR_DURATION = 1000

interface HighResolutionPhotoProps {
  isVisible: boolean
  photo: Photo
  src: string
  onError: (error: Error) => void
  onLoad: () => void
  onZoomChange: (scale: number) => void
  onZoomStateChange?: (isZoomed: boolean) => void
}

function HighResolutionPhoto({
  isVisible,
  photo,
  src,
  onError,
  onLoad,
  onZoomChange,
  onZoomStateChange,
}: HighResolutionPhotoProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 opacity-0 transition-opacity duration-200 ease-out motion-reduce:transition-none',
        isVisible && 'opacity-100',
      )}
    >
      <ZoomableImage
        src={src}
        alt={photo.title}
        width={photo.original.width}
        height={photo.original.height}
        onLoad={onLoad}
        onZoomChange={onZoomChange}
        onZoomStateChange={onZoomStateChange}
        onError={onError}
      />
    </div>
  )
}

export function ProgressivePhoto({
  photo,
  isActive,
  loadDelayMs = 0,
  onZoomStateChange,
  shouldMountInteractiveImage = true,
}: ProgressivePhotoProps) {
  const [currentScale, setCurrentScale] = useState(1)
  const [showScaleIndicator, setShowScaleIndicator] = useState(false)
  const scaleIndicatorTimeoutRef = useRef<number | null>(null)
  const { markDecoded, markRenderFailed, state } = useProgressivePhoto(photo, {
    isActive,
    loadDelayMs,
  })
  const hasHighResolutionPhoto =
    state.status === 'cached' ||
    state.status === 'decoding' ||
    state.status === 'ready'

  const handleZoomChange = (scale: number) => {
    setCurrentScale(scale)
    setShowScaleIndicator(true)

    if (scaleIndicatorTimeoutRef.current !== null) {
      window.clearTimeout(scaleIndicatorTimeoutRef.current)
    }

    scaleIndicatorTimeoutRef.current = window.setTimeout(() => {
      setShowScaleIndicator(false)
      scaleIndicatorTimeoutRef.current = null
    }, SCALE_INDICATOR_DURATION)
  }

  useEffect(
    () => () => {
      if (scaleIndicatorTimeoutRef.current !== null) {
        window.clearTimeout(scaleIndicatorTimeoutRef.current)
      }
    },
    [],
  )

  return (
    <div className="relative size-full overflow-hidden">
      <Image
        src={photo.thumbnail.url}
        alt=""
        aria-hidden
        width={photo.thumbnail.width}
        height={photo.thumbnail.height}
        className="absolute inset-0 size-full object-contain"
        loading="eager"
        unoptimized
      />

      {hasHighResolutionPhoto && isActive && shouldMountInteractiveImage && (
        <HighResolutionPhoto
          key={`${photo.id}:${state.src}`}
          isVisible={state.status === 'ready'}
          photo={photo}
          src={state.src}
          onError={markRenderFailed}
          onLoad={markDecoded}
          onZoomChange={handleZoomChange}
          onZoomStateChange={onZoomStateChange}
        />
      )}

      <LoadingIndicator state={state} />

      <div
        className={cn(
          'bg-base/70 text-text pointer-events-none absolute bottom-4 left-4 z-20 translate-y-2 rounded px-3 py-1 text-lg opacity-0 backdrop-blur-sm transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none',
          showScaleIndicator && 'translate-y-0 opacity-100',
        )}
      >
        {currentScale < 1 ? currentScale.toFixed(2) : currentScale.toFixed(1)}x
      </div>
    </div>
  )
}
