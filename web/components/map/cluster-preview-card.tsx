import { AlbumCoverLink } from './album-cover-link'
import type { AlbumMapItem } from './lib/album-map-data'
import { CLUSTER_PREVIEW_CAPACITY } from './lib/map-config'

export function ClusterPreviewCard({
  count,
  items,
}: {
  count: number
  items: AlbumMapItem[]
}) {
  const visibleItemLimit =
    count > CLUSTER_PREVIEW_CAPACITY
      ? CLUSTER_PREVIEW_CAPACITY - 1
      : CLUSTER_PREVIEW_CAPACITY
  const visibleItems = items.slice(0, visibleItemLimit)
  const remainingCount = count - visibleItems.length

  return (
    <section
      className="border-overlay bg-surface/95 space-y-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-2xl"
      aria-label={`${count} albums in this area`}
    >
      <h2 className="text-sm font-semibold">{count} albums</h2>

      <div className="grid grid-cols-3 gap-2">
        {visibleItems.map((item) => {
          const cover = item.covers[0]

          return (
            <AlbumCoverLink
              key={item.key}
              item={item}
              cover={cover}
              caption={item.label}
              className="aspect-square rounded-lg"
            />
          )
        })}

        {remainingCount > 0 && (
          <div className="bg-overlay grid aspect-square place-content-center rounded-lg text-center">
            <p className="text-lg font-semibold">+{remainingCount}</p>
            <p className="text-subtle text-[10px]">more</p>
          </div>
        )}
      </div>
    </section>
  )
}
