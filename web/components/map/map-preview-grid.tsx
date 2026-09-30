import Link from 'next/link'
import { MAP_PREVIEW_CAPACITY } from '@/lib/map-config'
import type { MapCover } from '@/lib/map-types'
import { cn } from '@/lib/style'
import { MapCoverLink } from './map-cover-link'

export function MapPreviewGrid({
  entries,
  count,
  moreHref,
}: {
  entries: {
    key: string
    label: string
    ariaLabel?: string
    cover: MapCover
    caption?: string
  }[]
  count: number
  moreHref?: string
}) {
  const visibleEntries = entries.slice(
    0,
    count > MAP_PREVIEW_CAPACITY
      ? MAP_PREVIEW_CAPACITY - 1
      : MAP_PREVIEW_CAPACITY,
  )
  const remainingCount = count - visibleEntries.length
  const moreContent = (
    <>
      <p className="text-lg font-semibold">+{remainingCount}</p>
      <p className="text-subtle group-hover/more:text-text group-focus-visible/more:text-text text-[10px] transition-colors">
        More
      </p>
    </>
  )
  const moreClassName =
    'bg-overlay grid aspect-square place-content-center rounded-lg text-center'

  return (
    <div className="grid grid-cols-3 gap-2">
      {visibleEntries.map(({ key, label, ariaLabel, cover, caption }) => (
        <MapCoverLink
          key={key}
          label={label}
          ariaLabel={ariaLabel}
          cover={cover}
          caption={caption}
          className="aspect-square rounded-lg"
        />
      ))}
      {remainingCount > 0 &&
        (moreHref ? (
          <Link
            href={moreHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              moreClassName,
              'group/more hover:bg-text/10 focus-visible:bg-text/10 transition-colors',
            )}
            aria-label={`Open album with ${remainingCount} more photos in a new tab`}
          >
            {moreContent}
          </Link>
        ) : (
          <div className={moreClassName}>{moreContent}</div>
        ))}
    </div>
  )
}
