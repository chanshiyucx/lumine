import Image from 'next/image'
import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import type { Photo } from '@/lib/photo'
import { cn } from '@/lib/style'
import { useProgressivePhoto } from './hooks/use-progressive-photo'
import {
  LoadingIndicator,
  type LoadingIndicatorHandle,
} from './loading-indicator'
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
  photo: Photo
  src: string
  loadingIndicatorRef: RefObject<LoadingIndicatorHandle | null>
  onError: (error: Error) => void
  onZoomChange: (scale: number) => void
  onZoomStateChange?: (isZoomed: boolean) => void
}

function HighResolutionPhoto({
  photo,
  src,
  loadingIndicatorRef,
  onError,
  onZoomChange,
  onZoomStateChange,
}: HighResolutionPhotoProps) {
  const [isVisible, setIsVisible] = useState(false)

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
        onLoad={() => {
          loadingIndicatorRef.current?.resetLoadingState()
          setIsVisible(true)
        }}
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
  const [failedResourceKey, setFailedResourceKey] = useState<string | null>(
    null,
  )
  const [currentScale, setCurrentScale] = useState(1)
  const [showScaleIndicator, setShowScaleIndicator] = useState(false)
  const scaleIndicatorTimeoutRef = useRef<number | null>(null)
  const loadingIndicatorRef = useRef<LoadingIndicatorHandle | null>(null)
  const state = useProgressivePhoto(photo, {
    isActive,
    loadDelayMs,
    loadingIndicatorRef,
  })

  const resourceKey = `${photo.id}:${state.blobSrc ?? ''}`
  const hasRenderFailed = failedResourceKey === resourceKey

  const handleImageError = (error: Error) => {
    console.error('Failed to render image:', error)
    setFailedResourceKey(resourceKey)

    if (isActive) {
      loadingIndicatorRef.current?.updateLoadingState({
        isVisible: true,
        isError: true,
        errorMessage: 'Failed to render image',
      })
    }
  }

  const handleZoomChange = (scale: number) => {
    startTransition(() => {
      setCurrentScale(scale)
      setShowScaleIndicator(true)
    })

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

      {state.blobSrc &&
        isActive &&
        shouldMountInteractiveImage &&
        !state.error &&
        !hasRenderFailed && (
          <HighResolutionPhoto
            key={resourceKey}
            photo={photo}
            src={state.blobSrc}
            loadingIndicatorRef={loadingIndicatorRef}
            onError={handleImageError}
            onZoomChange={handleZoomChange}
            onZoomStateChange={onZoomStateChange}
          />
        )}

      <LoadingIndicator ref={loadingIndicatorRef} />

      <div
        className={cn(
          'pointer-events-none absolute bottom-4 left-4 z-20 translate-y-2 rounded bg-black/50 px-3 py-1 text-lg text-white opacity-0 transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none',
          showScaleIndicator && 'translate-y-0 opacity-100',
        )}
      >
        {currentScale < 1 ? currentScale.toFixed(2) : currentScale.toFixed(1)}x
      </div>
    </div>
  )
}
