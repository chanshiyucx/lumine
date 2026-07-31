import { AlertCircle, LoaderCircle } from 'lucide-react'
import { forwardRef, useImperativeHandle, useState } from 'react'
import { formatBytes } from '@/lib/photo/formatters'

interface ViewerLoadingState {
  isVisible: boolean
  loadingProgress?: number
  loadedBytes?: number
  totalBytes?: number
  isError?: boolean
  errorMessage?: string
}

export interface LoadingIndicatorHandle {
  updateLoadingState: (state: Partial<ViewerLoadingState>) => void
  resetLoadingState: () => void
}

const initialLoadingState: ViewerLoadingState = {
  isVisible: false,
  loadingProgress: 0,
  loadedBytes: 0,
  totalBytes: 0,
  isError: false,
  errorMessage: undefined,
}

export const LoadingIndicator = forwardRef<LoadingIndicatorHandle>(
  function LoadingIndicator(_, ref) {
    const [loadingState, setLoadingState] =
      useState<ViewerLoadingState>(initialLoadingState)

    useImperativeHandle(
      ref,
      () => ({
        updateLoadingState: (partialState: Partial<ViewerLoadingState>) => {
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
        resetLoadingState: () => {
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
      <div className="bg-overlay/80 pointer-events-none absolute right-4 bottom-4 z-40 flex items-center gap-3 rounded-xl px-3 py-2 backdrop-blur-xl">
        {loadingState.isError ? (
          <AlertCircle className="size-4" />
        ) : (
          <LoaderCircle className="size-4 animate-spin" />
        )}

        <div className="min-w-24 text-xs">
          <p>
            {loadingState.isError
              ? (loadingState.errorMessage ?? 'Failed to load image')
              : `Loading ${Math.round(loadingState.loadingProgress ?? 0)}%`}
          </p>
          {!loadingState.isError && bytesLabel && <p>{bytesLabel}</p>}
        </div>
      </div>
    )
  },
)
