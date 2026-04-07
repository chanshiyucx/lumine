'use client'

/* eslint-disable @next/next/no-img-element */
import type { RefObject } from 'react'
import { WebGLImageViewer } from '@/components/webgl-viewer'
import type { GalleryPhoto } from '@/lib/photos'
import { cn } from '@/lib/style'
import { useProgressivePhoto } from './hooks/use-progressive-photo'
import { useWebGLLoadingState } from './hooks/use-webgl-loading-state'
import type { LoadingIndicatorRef } from './loading-indicator'

interface ProgressiveViewProps {
  photo: GalleryPhoto
  isActive: boolean
  className?: string
  loadingIndicatorRef: RefObject<LoadingIndicatorRef | null>
}

export function ProgressiveView({
  photo,
  isActive,
  className,
  loadingIndicatorRef,
}: ProgressiveViewProps) {
  const state = useProgressivePhoto(photo, {
    isActive,
    loadingIndicatorRef,
  })

  const canUseWebgl = Boolean(
    state.highResLoaded &&
    state.blobSrc &&
    typeof window !== 'undefined' &&
    window.WebGLRenderingContext,
  )

  const handleWebglLoadingStateChange = useWebGLLoadingState(
    loadingIndicatorRef,
    isActive,
    photo.id,
  )

  const handleFallbackImageLoad = () => {
    if (!isActive) {
      return
    }

    loadingIndicatorRef.current?.resetLoadingState(photo.id)
  }

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      <img
        src={photo.thumbnail.url}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-contain"
        loading="eager"
      />

      {state.highResLoaded &&
        state.blobSrc &&
        isActive &&
        !state.error &&
        (canUseWebgl ? (
          <div className="absolute inset-0 h-full w-full">
            <WebGLImageViewer
              src={state.blobSrc}
              width={photo.original.width}
              height={photo.original.height}
              className="absolute inset-0 h-full w-full"
              initialScale={1}
              minScale={1}
              maxScale={20}
              limitToBounds={true}
              centerOnInit={true}
              smooth={true}
              onLoadingStateChange={handleWebglLoadingStateChange}
            />
          </div>
        ) : (
          <img
            src={state.blobSrc}
            alt={photo.title}
            className="absolute inset-0 h-full w-full object-contain"
            draggable={false}
            onLoad={handleFallbackImageLoad}
          />
        ))}
    </div>
  )
}
