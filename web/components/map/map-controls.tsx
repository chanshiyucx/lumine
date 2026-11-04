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

const ATTRIBUTIONS = [
  { label: 'OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
  { label: 'CARTO', href: 'https://carto.com/attribution/' },
]

export function MapAttribution() {
  return (
    <p className="border-overlay bg-surface/85 text-subtle absolute right-[max(1.25rem,env(safe-area-inset-right))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 flex gap-2 rounded-lg border px-2.5 py-1 text-xs whitespace-nowrap shadow-xl backdrop-blur-xl">
      {ATTRIBUTIONS.map(({ label, href }) => (
        <a
          key={label}
          className="hover:text-text transition-colors"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
        >
          © {label}
        </a>
      ))}
    </p>
  )
}
