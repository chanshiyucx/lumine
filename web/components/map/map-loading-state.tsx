import { cn } from '@/lib/style'

export function MapLoadingState({ className }: { className?: string }) {
  return (
    <div
      className={cn('bg-base grid place-items-center', className)}
      role="status"
    >
      <div className="text-center">
        <div className="bg-overlay mx-auto mb-4 size-10 animate-pulse rounded-full motion-reduce:animate-none" />
        <p className="text-subtle text-sm">Loading places…</p>
      </div>
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
        <p className="text-text font-semibold">Map unavailable</p>
        <p className="text-subtle mt-1 text-sm">
          The map couldn’t load. Check your connection and try again.
        </p>
        <button
          type="button"
          className="border-text/20 bg-overlay hover:bg-text/15 focus-visible:outline-iris mt-4 cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={onRetry}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
