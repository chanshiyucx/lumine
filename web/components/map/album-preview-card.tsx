import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/style'
import { AlbumCoverLink } from './album-cover-link'
import type { AlbumMapItem } from './lib/album-map-data'

export function AlbumPreviewCard({ item }: { item: AlbumMapItem }) {
  const photoCountLabel = `${item.photoCount} ${item.photoCount === 1 ? 'photo' : 'photos'}`
  const detailLabel = `${item.dateLabel} · ${photoCountLabel}`
  const coverGridClassName =
    item.covers.length === 1
      ? 'grid-cols-1'
      : item.covers.length === 2
        ? 'grid-cols-2'
        : 'grid-cols-[3fr_2fr] grid-rows-2'

  return (
    <section
      className="border-overlay bg-surface/95 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-2xl"
      aria-label={`${item.label} album preview`}
    >
      <div className={cn('bg-overlay grid h-32 gap-px', coverGridClassName)}>
        {item.covers.map((cover, index) => (
          <AlbumCoverLink
            key={cover.thumbnail.url}
            item={item}
            cover={cover}
            loading="eager"
            className={
              item.covers.length > 2 && index === 0 ? 'row-span-2' : undefined
            }
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 p-4">
        <Link
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="group/link hover:text-iris focus-visible:outline-iris flex min-w-0 flex-1 items-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-label={`Open ${item.label} album in a new tab`}
        >
          <h2 className="truncate text-sm font-semibold">{item.label}</h2>
          <ArrowUpRight className="text-subtle size-4 shrink-0 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
        </Link>

        <p className="text-subtle shrink-0 text-xs">{detailLabel}</p>
      </div>
    </section>
  )
}
