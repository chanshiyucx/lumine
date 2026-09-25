import { AddLine } from '@mingcute/react/add'
import { FullscreenLine } from '@mingcute/react/fullscreen'
import { FullscreenExitLine } from '@mingcute/react/fullscreen-exit'
import { MinimizeLine } from '@mingcute/react/minimize'

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
    { label: 'Zoom in', icon: AddLine, action: onZoomIn },
    { label: 'Zoom out', icon: MinimizeLine, action: onZoomOut },
    showingAll
      ? {
          label: 'Return to default view',
          icon: FullscreenExitLine,
          action: onToggleExtent,
        }
      : {
          label: 'Show all places',
          icon: FullscreenLine,
          action: onToggleExtent,
        },
  ]

  return (
    <div className="border-overlay bg-surface/85 divide-overlay absolute bottom-6 left-3 z-10 flex flex-col divide-y overflow-hidden rounded-xl border shadow-xl backdrop-blur-xl sm:left-5">
      {controls.map(({ label, icon: Icon, action }) => (
        <button
          key={label}
          type="button"
          className="hover:bg-overlay grid size-10 cursor-pointer place-items-center transition-colors"
          aria-label={label}
          onClick={action}
        >
          <Icon className="size-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
