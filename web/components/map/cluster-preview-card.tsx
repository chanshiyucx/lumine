import type { MapItem } from '@/lib/album/map'
import { MapPreviewGrid } from './map-preview-grid'

export function ClusterPreviewCard({
  count,
  items,
}: {
  count: number
  items: MapItem[]
}) {
  return (
    <section
      className="border-overlay bg-surface/95 space-y-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-2xl"
      aria-label={`${count} albums in this area`}
    >
      <h2 className="text-sm font-semibold">{count} albums</h2>

      <MapPreviewGrid
        entries={items.map((item) => ({
          key: item.key,
          label: item.label,
          cover: item.covers[0],
          caption: item.label,
        }))}
        count={count}
      />
    </section>
  )
}
