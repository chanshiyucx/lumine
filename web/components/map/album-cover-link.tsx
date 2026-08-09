import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/style'
import { AlbumMapCoverImage } from './album-map-cover'
import type { AlbumMapCover, AlbumMapItem } from './lib/album-map-data'

export function AlbumCoverLink({
  item,
  cover,
  caption,
  className,
  loading = 'lazy',
}: {
  item: AlbumMapItem
  cover: AlbumMapCover
  caption?: string
  className?: string
  loading?: 'eager' | 'lazy'
}) {
  return (
    <Link
      href={cover.href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group bg-overlay relative block cursor-pointer overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
        className,
      )}
      aria-label={`Open a photo from ${item.label} in a new tab`}
    >
      <AlbumMapCoverImage
        cover={cover}
        loading={loading}
        scaleOnHover
      />
      <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/20 group-focus-visible:bg-black/20" />
      {caption && (
        <>
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/75 to-transparent" />
          <span className="pointer-events-none absolute right-1.5 bottom-1.5 left-1.5 truncate text-[11px] font-medium text-white drop-shadow-sm">
            {caption}
          </span>
        </>
      )}
      <span className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="grid size-8 scale-90 place-items-center rounded-full bg-black/65 text-white shadow-lg transition-transform duration-250 ease-out group-hover:scale-100 group-focus-visible:scale-100">
          <ExternalLink className="size-4" />
        </span>
      </span>
    </Link>
  )
}
