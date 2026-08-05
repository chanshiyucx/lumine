import { ArrowUpRight, CalendarDays, Images, X } from 'lucide-react'
import Link from 'next/link'
import type { AlbumMapItem } from '@/lib/map/album-map-data'
import { AlbumCoverLink } from './album-cover-link'

export function AlbumPreviewCard({
  item,
  selected,
  onClose,
}: {
  item: AlbumMapItem
  selected: boolean
  onClose: () => void
}) {
  const photoCountLabel = `${item.photoCount} ${item.photoCount === 1 ? 'photo' : 'photos'}`

  return (
    <section
      className="album-map-preview-card border-text/15 bg-base/95 relative overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-[120px]"
      aria-label={`${item.label} album preview`}
    >
      {selected && (
        <button
          type="button"
          className="circle-button absolute top-3 right-3 z-10 cursor-pointer"
          aria-label="Close album preview"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
      )}

      <div className="grid h-32 grid-cols-[3fr_2fr] grid-rows-2 gap-px bg-black/20">
        {item.covers.slice(0, 3).map((cover, index) => (
          <AlbumCoverLink
            key={`${cover.url}-${index}`}
            item={item}
            cover={cover}
            loading="eager"
            className={index === 0 ? 'row-span-2' : undefined}
          />
        ))}
      </div>

      <div className="space-y-3 p-4">
        <Link
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="group/link hover:text-iris flex items-center gap-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label={`Open ${item.label} album in a new tab`}
        >
          <h2 className="text-text flex-1 truncate text-sm font-semibold">
            {item.label}
          </h2>
          <ArrowUpRight className="text-subtle size-4 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
        </Link>

        <div className="text-subtle flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            <span>{item.dateLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Images className="size-3.5" />
            <span>{photoCountLabel}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
