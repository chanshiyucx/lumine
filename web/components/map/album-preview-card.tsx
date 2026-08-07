import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { AlbumCoverLink } from './album-cover-link'
import type { AlbumMapItem } from './lib/album-map-data'

export function AlbumPreviewCard({ item }: { item: AlbumMapItem }) {
  return (
    <section
      className="border-text/15 bg-base/95 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-[120px]"
      aria-label={`${item.label} album preview`}
    >
      <AlbumPreviewContent item={item} />
    </section>
  )
}

export function AlbumPreviewContent({ item }: { item: AlbumMapItem }) {
  const photoCountLabel = `${item.photoCount} ${item.photoCount === 1 ? 'photo' : 'photos'}`
  const detailLabel = [item.dateLabel, photoCountLabel]
    .filter(Boolean)
    .join(' · ')

  return (
    <>
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

      <div className="flex items-center justify-between gap-3 p-4">
        <Link
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="group/link hover:text-iris flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label={`Open ${item.label} album in a new tab`}
        >
          <h2 className="text-text truncate text-sm font-semibold">
            {item.label}
          </h2>
          <ArrowUpRight className="text-subtle size-4 shrink-0 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
        </Link>

        <p className="text-subtle shrink-0 text-xs">{detailLabel}</p>
      </div>
    </>
  )
}
