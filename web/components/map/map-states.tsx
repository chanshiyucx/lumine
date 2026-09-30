import { LocationLine } from '@mingcute/react/location'
import { cn } from '@/lib/style'

export function MapLoadingState({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-base flex flex-col items-center justify-center gap-2 text-center',
        className,
      )}
      role="status"
    >
      <div
        className="text-subtle relative grid size-16 shrink-0 place-items-center"
        aria-hidden="true"
      >
        <span className="map-loading-halo border-subtle/40 absolute inset-2 rounded-full border" />
        <span className="map-loading-icon relative block size-6">
          <LocationLine className="size-6" />
        </span>
      </div>
      <p className="text-subtle text-xs">Loading places…</p>
    </div>
  )
}

export function MapErrorState({
  className,
  onRetry,
}: {
  className?: string
  onRetry: () => void
}) {
  return (
    <div
      className={cn('bg-base grid place-items-center', className)}
      role="alert"
    >
      <div className="max-w-xs px-6 text-center">
        <p className="font-semibold">Map unavailable</p>
        <p className="text-subtle mt-1 text-sm">
          The map couldn’t load. Check your connection and try again.
        </p>
        <button
          type="button"
          className="border-overlay bg-surface hover:bg-overlay mt-4 cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors"
          onClick={onRetry}
        >
          Try again
        </button>
      </div>
    </div>
  )
}

export function MapEmptyState() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
      <p className="border-overlay bg-surface/95 text-subtle rounded-full border px-4 py-2 text-sm shadow-xl">
        No mapped albums yet
      </p>
    </div>
  )
}
