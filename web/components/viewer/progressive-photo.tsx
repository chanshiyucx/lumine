/* eslint-disable @next/next/no-img-element */
import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
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
  onZoomStateChange?: (isZoomed: boolean) => void
}

const SCALE_INDICATOR_DURATION = 1000

export const ProgressivePhoto = memo(function ProgressivePhoto({
  photo,
  isActive,
  onZoomStateChange,
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
    loadingIndicatorRef,
  })

  const resourceKey = `${photo.id}:${state.blobSrc ?? ''}`
  const hasRenderFailed = failedResourceKey === resourceKey

  const handleImageLoad = () => {
    if (!isActive) {
      return
    }

    loadingIndicatorRef.current?.resetLoadingState()
  }

  const handleImageError = useCallback(
    (error: Error) => {
      console.error('Failed to render image:', error)
      setFailedResourceKey(resourceKey)

      if (isActive) {
        loadingIndicatorRef.current?.updateLoadingState({
          isVisible: true,
          isError: true,
          errorMessage: 'Failed to render image',
        })
      }
    },
    [isActive, resourceKey],
  )

  const handleZoomChange = useCallback((scale: number) => {
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
  }, [])

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
      <img
        src={photo.thumbnail.url}
        alt=""
        aria-hidden
        className="absolute inset-0 size-full object-contain"
        loading="eager"
      />

      {state.blobSrc && isActive && !state.error && !hasRenderFailed && (
        <ZoomableImage
          src={state.blobSrc}
          alt={photo.title}
          width={photo.original.width}
          height={photo.original.height}
          onLoad={handleImageLoad}
          onZoomChange={handleZoomChange}
          onZoomStateChange={onZoomStateChange}
          onError={handleImageError}
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
})
