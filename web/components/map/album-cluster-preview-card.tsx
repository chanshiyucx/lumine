import type { AlbumMapItem } from '@/lib/map-types'
import { MapPreviewGrid } from './map-preview-grid'

interface AlbumClusterPreviewCardProps {
  count: number
  items: readonly AlbumMapItem[]
}

export function AlbumClusterPreviewCard({
  count,
  items,
}: AlbumClusterPreviewCardProps) {
  return (
    <section
      className="space-y-3 p-4"
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
