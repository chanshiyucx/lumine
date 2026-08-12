import { AlertCircle, LoaderCircle } from 'lucide-react'
import type { PhotoResourceState } from './lib/photo-resource-store'

const BYTES_PER_MEBIBYTE = 1024 * 1024

interface LoadingIndicatorProps {
  state: PhotoResourceState
}

function formatLoadingBytes(bytes: number) {
  return `${(bytes / BYTES_PER_MEBIBYTE).toFixed(1)} MB`
}

function getBytesLabel(loadedBytes: number, totalBytes: number) {
  if (totalBytes <= 0) {
    return loadedBytes > 0 ? formatLoadingBytes(loadedBytes) : ''
  }

  return `${formatLoadingBytes(loadedBytes)} / ${formatLoadingBytes(totalBytes)}`
}

export function LoadingIndicator({ state }: LoadingIndicatorProps) {
  if (
    state.status === 'cached' ||
    state.status === 'idle' ||
    state.status === 'ready'
  ) {
    return null
  }

  const isError = state.status === 'error'
  const bytesLabel = isError
    ? null
    : getBytesLabel(state.loadedBytes, state.totalBytes)

  return (
    <div className="bg-overlay/80 pointer-events-none absolute right-4 bottom-4 z-40 flex items-center gap-3 rounded-xl px-3 py-2 backdrop-blur-xl">
      {isError ? (
        <AlertCircle className="size-4" />
      ) : (
        <LoaderCircle className="size-4 animate-spin" />
      )}

      <div className="w-28 text-xs">
        {isError ? (
          <p>{state.message}</p>
        ) : (
          <>
            <p>Loading {Math.round(state.progress)}%</p>
            {bytesLabel && <p>{bytesLabel}</p>}
          </>
        )}
      </div>
    </div>
  )
}
