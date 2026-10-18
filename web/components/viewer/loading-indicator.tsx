import { AlertLine } from '@mingcute/react/alert'
import { Loading3Line } from '@mingcute/react/loading-3'
import {
  formatProgressBytes,
  type PhotoResourceState,
} from './hooks/use-progressive-photo'

interface LoadingIndicatorProps {
  state: PhotoResourceState
}

function getBytesLabel(loadedBytes: number, totalBytes: number) {
  if (totalBytes <= 0) {
    return loadedBytes > 0 ? formatProgressBytes(loadedBytes) : ''
  }

  return `${formatProgressBytes(loadedBytes)} / ${formatProgressBytes(totalBytes)}`
}

export function LoadingIndicator({ state }: LoadingIndicatorProps) {
  if (state.status === 'ready') {
    return null
  }

  const isError = state.status === 'error'
  const bytesLabel = isError
    ? null
    : getBytesLabel(state.loadedBytes, state.totalBytes)

  return (
    <div className="bg-overlay/80 pointer-events-none absolute right-4 bottom-4 z-40 flex items-center gap-3 rounded-xl px-3 py-2 backdrop-blur-xl">
      {isError ? (
        <AlertLine className="size-4" aria-hidden="true" />
      ) : (
        <Loading3Line className="size-4 animate-spin" aria-hidden="true" />
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
