'use client'

import { AlertCircle, LoaderCircle } from 'lucide-react'
import { forwardRef, useImperativeHandle, useRef, useState } from 'react'

export interface ViewerLoadingState {
  isVisible: boolean
  loadingProgress?: number
  loadedBytes?: number
  totalBytes?: number
  isWebGLLoading?: boolean
  webglMessage?: string
  webglQuality?: 'high' | 'medium' | 'low' | 'unknown'
  isError?: boolean
  errorMessage?: string
}

export interface LoadingIndicatorRef {
  updateLoadingState: (
    ownerId: string,
    state: Partial<ViewerLoadingState>,
  ) => void
  resetLoadingState: (ownerId?: string) => void
}

const initialLoadingState: ViewerLoadingState = {
  isVisible: false,
  loadingProgress: 0,
  loadedBytes: 0,
  totalBytes: 0,
  isWebGLLoading: false,
  webglMessage: undefined,
  webglQuality: 'unknown',
  isError: false,
  errorMessage: undefined,
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes}B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

interface LoadingIndicatorProps {
  ownerId: string
}

export const LoadingIndicator = forwardRef<
  LoadingIndicatorRef,
  LoadingIndicatorProps
>(function LoadingIndicator({ ownerId }, ref) {
  const [loadingState, setLoadingState] =
    useState<ViewerLoadingState>(initialLoadingState)
  const activeOwnerRef = useRef(ownerId)

  useImperativeHandle(
    ref,
    () => ({
      updateLoadingState: (
        nextOwnerId: string,
        partialState: Partial<ViewerLoadingState>,
      ) => {
        if (activeOwnerRef.current !== nextOwnerId) {
          return
        }

        setLoadingState((current) => {
          if (partialState.isVisible === false) {
            return initialLoadingState
          }

          return {
            ...current,
            ...partialState,
            isVisible: partialState.isVisible ?? true,
          }
        })
      },
      resetLoadingState: (nextOwnerId?: string) => {
        if (
          nextOwnerId !== undefined &&
          activeOwnerRef.current !== nextOwnerId
        ) {
          return
        }

        setLoadingState(initialLoadingState)
      },
    }),
    [],
  )

  const loadedBytes = loadingState.loadedBytes ?? 0
  const totalBytes = loadingState.totalBytes ?? 0
  const bytesLabel =
    totalBytes <= 0
      ? loadedBytes > 0
        ? formatBytes(loadedBytes)
        : ''
      : `${formatBytes(loadedBytes)} / ${formatBytes(totalBytes)}`

  if (!loadingState.isVisible) {
    return null
  }

  return (
    <div className="pointer-events-none absolute right-4 bottom-4 z-40">
      <div className="bg-overlay/80 flex items-center gap-3 rounded-xl px-3 py-2 backdrop-blur-xl">
        {loadingState.isError ? (
          <AlertCircle className="text-text size-4" />
        ) : (
          <LoaderCircle className="text-text size-4 animate-spin" />
        )}

        <div className="min-w-24 text-xs">
          {loadingState.isError ? (
            <p className="font-medium">
              {loadingState.errorMessage ?? 'Failed to load image'}
            </p>
          ) : loadingState.isWebGLLoading ? (
            <>
              <div className="flex items-center gap-2">
                <p className="font-medium">
                  {loadingState.webglMessage ?? 'Decoding image'}
                </p>
                {loadingState.webglQuality &&
                loadingState.webglQuality !== 'unknown' ? (
                  <span className="text-text/70 tabular-nums">
                    {loadingState.webglQuality}
                  </span>
                ) : null}
              </div>
              <p className="text-text/70">Building render pipeline</p>
            </>
          ) : (
            <>
              <p className="font-medium tabular-nums">
                Loading {Math.round(loadingState.loadingProgress ?? 0)}%
              </p>
              {bytesLabel && <p className="tabular-nums">{bytesLabel}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
})
