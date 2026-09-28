import type { MapItem } from '@/lib/album/map'
import { MapCoordinates } from './map-coordinates'
import { MapPreviewGrid } from './map-preview-grid'

export function PhotoClusterPreviewCard({
  items,
  count,
  location,
}: {
  items: MapItem[]
  count: number
  location: { lat: number; lng: number }
}) {
  return (
    <section
      className="border-overlay bg-surface/95 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-2xl"
      aria-label={`${count} photos at this location`}
    >
      <div className="p-4 pb-0">
        <MapPreviewGrid
          entries={items.map((item) => ({
            key: item.key,
            label: item.label,
            ariaLabel: `Open photo ${item.label} in a new tab`,
            cover: item.covers[0],
          }))}
          count={count}
        />
      </div>
      <div className="text-subtle p-4 text-xs">
        <MapCoordinates location={location} />
      </div>
    </section>
  )
}
