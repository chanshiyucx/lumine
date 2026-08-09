import { Maximize2, Minimize2, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/style'

export function MapControls({
  hidden = false,
  onZoomIn,
  onZoomOut,
  onToggleExtent,
  showingAll,
}: {
  hidden?: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onToggleExtent: () => void
  showingAll: boolean
}) {
  const controls = [
    { label: 'Zoom in', icon: Plus, action: onZoomIn },
    { label: 'Zoom out', icon: Minus, action: onZoomOut },
    showingAll
      ? {
          label: 'Return to default view',
          icon: Minimize2,
          action: onToggleExtent,
        }
      : {
          label: 'Show all places',
          icon: Maximize2,
          action: onToggleExtent,
        },
  ]

  return (
    <div
      className={cn(
        'absolute bottom-6 left-3 z-10 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-black/55 shadow-xl backdrop-blur-xl transition-[opacity,transform] duration-150 sm:left-5',
        hidden && 'pointer-events-none translate-y-2 opacity-0',
      )}
    >
      {controls.map(({ label, icon: Icon, action }, index) => (
        <button
          key={label}
          type="button"
          className={cn(
            'text-text grid size-10 cursor-pointer place-items-center transition-colors hover:bg-white/10 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-white',
            index > 0 && 'border-t border-white/10',
          )}
          aria-label={label}
          onClick={action}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  )
}
