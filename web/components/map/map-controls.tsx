import { Compass, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/style'

export function MapControls({
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}) {
  const controls = [
    { label: 'Zoom in', icon: Plus, action: onZoomIn },
    { label: 'Zoom out', icon: Minus, action: onZoomOut },
    { label: 'Show all places', icon: Compass, action: onReset },
  ]

  return (
    <div className="absolute bottom-6 left-3 z-10 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-black/55 shadow-xl backdrop-blur-xl sm:left-5">
      {controls.map(({ label, icon: Icon, action }, index) => (
        <button
          key={label}
          type="button"
          className={cn(
            'text-text grid size-10 cursor-pointer place-items-center transition-colors hover:bg-white/10 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-white',
            index > 0 && 'border-t border-white/10',
          )}
          aria-label={label}
          title={label}
          onClick={action}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  )
}
