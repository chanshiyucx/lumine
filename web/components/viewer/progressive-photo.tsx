import { m, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { ThumbnailImage } from '@/components/image/thumbnail-image'
import { useTimeout } from '@/hooks/use-timeout'
import type { Photo } from '@/lib/photo'
import { cn } from '@/lib/style'
import { useProgressivePhoto } from './hooks/use-progressive-photo'
import { VIEWER_MOTION } from './lib/viewer-motion'
import { LoadingIndicator } from './loading-indicator'
import { ZoomableImage } from './zoomable-image'

interface ProgressivePhotoProps {
  photo: Photo
  isActive: boolean
  isZoomEnabled: boolean
  loadDelayMs: number
  onZoomStateChange?: (isZoomed: boolean) => void
  shouldMountInteractiveImage: boolean
}

type ActiveProgressivePhotoProps = Omit<ProgressivePhotoProps, 'isActive'>

const SCALE_INDICATOR_DURATION = 1000

function formatScaleLabel(scale: number) {
  return `${scale < 1 ? scale.toFixed(2) : scale.toFixed(1)}x`
}

interface PhotoThumbnailProps {
  photo: Photo
}

function PhotoThumbnail({ photo }: PhotoThumbnailProps) {
  return (
    <ThumbnailImage
      photo={photo}
      fit="contain"
      loading="eager"
      showPlaceholder={false}
    />
  )
}

function ActiveProgressivePhoto({
  photo,
  isZoomEnabled,
  loadDelayMs,
  onZoomStateChange,
  shouldMountInteractiveImage,
}: ActiveProgressivePhotoProps) {
  const reduceMotion = useReducedMotion()
  const [settledSource, setSettledSource] = useState<string | null>(null)
  const [scaleLabel, setScaleLabel] = useState(() => formatScaleLabel(1))
  const [showScaleIndicator, setShowScaleIndicator] = useState(false)
  const { schedule: scheduleScaleIndicatorHide } = useTimeout()
  const { markDecoded, markRenderFailed, state } = useProgressivePhoto(
    photo,
    loadDelayMs,
  )
  const hasHighResolutionPhoto =
    state.status === 'decoding' || state.status === 'ready'
  const highResolutionSource = hasHighResolutionPhoto ? state.src : null
  const isOriginalReady = state.status === 'ready'
  const isOriginalSettled = isOriginalReady && settledSource === state.src
  const isOriginalDisplayed = shouldMountInteractiveImage && isOriginalSettled

  const handleOriginalLoad = () => {
    if (!highResolutionSource) {
      return
    }

    markDecoded()

    if (reduceMotion) {
      setSettledSource(highResolutionSource)
    }
  }

  const handleOriginalAnimationComplete = () => {
    if (state.status === 'ready') {
      setSettledSource(state.src)
    }
  }

  const handleZoomChange = (scale: number) => {
    setScaleLabel(formatScaleLabel(scale))
    setShowScaleIndicator(true)
    scheduleScaleIndicatorHide(
      () => setShowScaleIndicator(false),
      SCALE_INDICATOR_DURATION,
    )
  }

  return (
    <>
      {!isOriginalDisplayed && <PhotoThumbnail photo={photo} />}

      {hasHighResolutionPhoto && shouldMountInteractiveImage && (
        <m.div
          key={`${photo.id}:${state.src}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: isOriginalReady ? 1 : 0 }}
          transition={
            reduceMotion ? { duration: 0 } : VIEWER_MOTION.originalFadeIn
          }
          onAnimationComplete={handleOriginalAnimationComplete}
          className={cn(
            'pointer-events-none absolute inset-0',
            isOriginalSettled && 'pointer-events-auto',
          )}
        >
          <ZoomableImage
            src={state.src}
            alt={photo.title}
            width={photo.original.width}
            height={photo.original.height}
            isZoomEnabled={isZoomEnabled}
            onLoad={handleOriginalLoad}
            onZoomChange={handleZoomChange}
            onZoomStateChange={onZoomStateChange}
            onError={markRenderFailed}
          />
        </m.div>
      )}

      <LoadingIndicator state={state} />

      <div
        className={cn(
          'bg-base/70 text-text pointer-events-none absolute bottom-4 left-4 z-20 translate-y-2 rounded px-3 py-1 text-lg opacity-0 backdrop-blur-sm transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none',
          showScaleIndicator && 'translate-y-0 opacity-100',
        )}
      >
        {scaleLabel}
      </div>
    </>
  )
}

export function ProgressivePhoto({
  isActive,
  ...props
}: ProgressivePhotoProps) {
  return isActive ? (
    <ActiveProgressivePhoto {...props} />
  ) : (
    <PhotoThumbnail photo={props.photo} />
  )
}
