import { m, useReducedMotion } from 'motion/react'
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

function formatScaleLabel(scale: number) {
  return `${scale < 1 ? scale.toFixed(2) : scale.toFixed(1)}x`
}

export function ProgressivePhoto({
  photo,
  isActive,
  loadDelayMs = 0,
  onZoomStateChange,
  shouldMountInteractiveImage = true,
}: ProgressivePhotoProps) {
  const reduceMotion = useReducedMotion()
  const [loadedSource, setLoadedSource] = useState<string | null>(null)
  const [settledSource, setSettledSource] = useState<string | null>(null)
  const [scaleLabel, setScaleLabel] = useState(() => formatScaleLabel(1))
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
  const highResolutionSource = hasHighResolutionPhoto ? state.src : null
  const isOriginalReady = state.status === 'ready' && loadedSource === state.src
  const isOriginalSettled = isOriginalReady && settledSource === state.src
  const isOriginalDisplayed =
    isActive && shouldMountInteractiveImage && isOriginalSettled

  const handleOriginalLoad = () => {
    if (!highResolutionSource) {
      return
    }

    setLoadedSource(highResolutionSource)
    markDecoded()

    if (reduceMotion) {
      setSettledSource(highResolutionSource)
    }
  }

  const handleOriginalAnimationComplete = () => {
    if (state.status === 'ready' && loadedSource === state.src) {
      setSettledSource(state.src)
    }
  }

  const handleZoomChange = (scale: number) => {
    const nextScaleLabel = formatScaleLabel(scale)
    setScaleLabel((current) =>
      current === nextScaleLabel ? current : nextScaleLabel,
    )
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
      {!isOriginalDisplayed && (
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
      )}

      {hasHighResolutionPhoto && isActive && shouldMountInteractiveImage && (
        <m.div
          key={`${photo.id}:${state.src}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: isOriginalReady ? 1 : 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.2,
            ease: 'easeOut',
          }}
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
    </div>
  )
}
