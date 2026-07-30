'use client'

/* eslint-disable @next/next/no-img-element */
import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { ImageViewer, type ImageViewerProps } from '@/components/image-viewer'
import { WebGLImageViewer } from '@/components/webgl-viewer'
import type { Photo } from '@/lib/photos'
import { cn } from '@/lib/style'
import { useImageViewerRenderer } from './hooks/use-image-viewer-renderer'
import { useProgressivePhoto } from './hooks/use-progressive-photo'
import { useWebGLLoadingState } from './hooks/use-webgl-loading-state'
import type { LoadingIndicatorRef } from './loading-indicator'

interface ProgressiveViewProps {
  photo: Photo
  isActive: boolean
  className?: string
  loadingIndicatorRef: RefObject<LoadingIndicatorRef | null>
}

const SCALE_INDICATOR_DURATION = 1000

export const ProgressiveView = memo(function ProgressiveView({
  photo,
  isActive,
  className,
  loadingIndicatorRef,
}: ProgressiveViewProps) {
  const rendererState = useImageViewerRenderer()
  const renderer = rendererState?.renderer ?? null
  const [viewerFailureKey, setViewerFailureKey] = useState<string | null>(null)
  const [currentScale, setCurrentScale] = useState(1)
  const [showScaleIndicator, setShowScaleIndicator] = useState(false)
  const scaleIndicatorTimeoutRef = useRef<number | null>(null)
  const state = useProgressivePhoto(photo, {
    isActive,
    loadingIndicatorRef,
  })

  const viewerResourceKey = `${renderer ?? 'pending'}:${photo.id}:${state.blobSrc ?? ''}`
  const webglUnavailable =
    renderer === 'webgl' &&
    state.resourceLoaded &&
    Boolean(state.blobSrc) &&
    typeof window !== 'undefined' &&
    !window.WebGLRenderingContext
  const viewerFailed =
    viewerFailureKey === viewerResourceKey || webglUnavailable

  const webglSupported = Boolean(
    renderer === 'webgl' &&
    state.resourceLoaded &&
    state.blob &&
    state.blobSrc &&
    typeof window !== 'undefined' &&
    window.WebGLRenderingContext,
  )

  const handleWebglLoadingStateChange = useWebGLLoadingState(
    loadingIndicatorRef,
    isActive,
    photo.id,
  )

  const handleViewerLoad = () => {
    if (!isActive) {
      return
    }

    loadingIndicatorRef.current?.resetLoadingState(photo.id)
  }

  const handleViewerError = useCallback(
    (error: Error) => {
      console.error(`Failed to render image with ${renderer}:`, error)
      setViewerFailureKey(viewerResourceKey)

      if (isActive) {
        loadingIndicatorRef.current?.updateLoadingState(photo.id, {
          isVisible: true,
          isError: true,
          errorMessage: 'Failed to render image',
        })
      }
    },
    [isActive, loadingIndicatorRef, photo.id, renderer, viewerResourceKey],
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

  useEffect(() => {
    if (!webglUnavailable || !isActive) {
      return
    }

    console.error('Failed to render image with webgl: WebGL is not supported')
    loadingIndicatorRef.current?.updateLoadingState(photo.id, {
      isVisible: true,
      isError: true,
      errorMessage: 'Failed to render image',
    })
  }, [isActive, loadingIndicatorRef, photo.id, webglUnavailable])

  const sharedViewerProps = {
    src: state.blobSrc ?? '',
    alt: photo.title,
    width: photo.original.width,
    height: photo.original.height,
    className: 'absolute inset-0 h-full w-full',
    initialScale: 1,
    minScale: 1,
    maxScale: 20,
    limitToBounds: true,
    centerOnInit: true,
    smooth: true,
    onLoad: handleViewerLoad,
    onZoomChange: handleZoomChange,
    onError: handleViewerError,
  } satisfies ImageViewerProps

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      <img
        src={photo.thumbnail.url}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-contain"
        loading="eager"
      />

      {state.resourceLoaded &&
        state.blobSrc &&
        isActive &&
        !state.error &&
        renderer &&
        !viewerFailed &&
        (renderer === 'webgl' ? (
          webglSupported ? (
            <WebGLImageViewer
              {...sharedViewerProps}
              sourceBlob={state.blob ?? undefined}
              debug={rendererState?.debug}
              onLoadingStateChange={handleWebglLoadingStateChange}
            />
          ) : null
        ) : (
          <ImageViewer {...sharedViewerProps} />
        ))}

      <div
        className={cn(
          'pointer-events-none absolute bottom-4 left-4 z-20 translate-y-2 rounded bg-black/50 px-3 py-1 text-lg text-white tabular-nums opacity-0 transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none',
          showScaleIndicator && 'translate-y-0 opacity-100',
        )}
      >
        {currentScale < 1 ? currentScale.toFixed(2) : currentScale.toFixed(1)}x
      </div>
    </div>
  )
})
