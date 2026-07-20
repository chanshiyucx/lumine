'use client'

/* eslint-disable @next/next/no-img-element */
import { memo, useCallback, useState, type RefObject } from 'react'
import { WebGLImageViewer } from '@/components/webgl-viewer'
import { isProd } from '@/lib/env'
import type { Photo } from '@/lib/photos'
import { cn } from '@/lib/style'
import { useProgressivePhoto } from './hooks/use-progressive-photo'
import { useWebGLLoadingState } from './hooks/use-webgl-loading-state'
import type { LoadingIndicatorRef } from './loading-indicator'

interface ProgressiveViewProps {
  photo: Photo
  isActive: boolean
  className?: string
  loadingIndicatorRef: RefObject<LoadingIndicatorRef | null>
}

export const ProgressiveView = memo(function ProgressiveView({
  photo,
  isActive,
  className,
  loadingIndicatorRef,
}: ProgressiveViewProps) {
  const [webglFailureKey, setWebglFailureKey] = useState<string | null>(null)
  const state = useProgressivePhoto(photo, {
    isActive,
    loadingIndicatorRef,
  })

  const webglResourceKey = `${photo.id}:${state.blobSrc ?? ''}`
  const webglFailed = webglFailureKey === webglResourceKey

  const canUseWebgl = Boolean(
    state.resourceLoaded &&
    state.blob &&
    state.blobSrc &&
    !webglFailed &&
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

  const handleWebglError = useCallback(() => {
    setWebglFailureKey(webglResourceKey)
  }, [webglResourceKey])

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
        (canUseWebgl ? (
          <div className="absolute inset-0 h-full w-full">
            <WebGLImageViewer
              src={state.blobSrc}
              sourceBlob={state.blob ?? undefined}
              width={photo.original.width}
              height={photo.original.height}
              className="absolute inset-0 h-full w-full"
              initialScale={1}
              minScale={1}
              maxScale={20}
              limitToBounds
              centerOnInit
              smooth
              debug={!isProd}
              onError={handleWebglError}
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
})
