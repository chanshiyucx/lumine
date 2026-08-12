import { Maximize2, Minimize2, Minus, Plus } from 'lucide-react'

export function MapControls({
  onZoomIn,
  onZoomOut,
  onToggleExtent,
  showingAll,
}: {
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
    <div className="border-overlay bg-surface/85 divide-overlay absolute bottom-6 left-3 z-10 flex flex-col divide-y overflow-hidden rounded-xl border shadow-xl backdrop-blur-xl sm:left-5">
      {controls.map(({ label, icon: Icon, action }) => (
        <button
          key={label}
          type="button"
          className="hover:bg-overlay focus-visible:outline-iris grid size-10 cursor-pointer place-items-center transition-colors focus-visible:z-10 focus-visible:outline-2"
          aria-label={label}
          onClick={action}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  )
}
