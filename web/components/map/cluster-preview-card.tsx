import { AlbumCoverLink } from './album-cover-link'
import type { AlbumMapItem } from './lib/album-map-data'

export function ClusterPreviewCard({
  count,
  items,
}: {
  count: number
  items: AlbumMapItem[]
}) {
  return (
    <section
      className="album-map-preview-card border-text/15 bg-base/95 rounded-2xl border shadow-2xl backdrop-blur-[120px]"
      aria-label={`${count} albums in this area`}
    >
      <ClusterPreviewContent count={count} items={items} />
    </section>
  )
}

export function ClusterPreviewContent({
  count,
  items,
}: {
  count: number
  items: AlbumMapItem[]
}) {
  const visibleItems = items.slice(0, count > 6 ? 5 : 6)
  const remainingCount = Math.max(0, count - visibleItems.length)

  return (
    <div className="space-y-3 p-4">
      <h2 className="text-text text-sm font-semibold">{count} albums</h2>

      <div className="grid grid-cols-3 gap-2">
        {visibleItems.map((item) => {
          const cover = item.covers[0]
          if (!cover) return null

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
          <div className="bg-overlay text-text grid aspect-square place-items-center rounded-lg">
            <div className="text-center">
              <p className="text-lg font-semibold">+{remainingCount}</p>
              <p className="text-subtle text-[10px]">more</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
