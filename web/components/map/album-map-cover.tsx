import { ThumbnailImage } from '@/components/photo'
import { cn } from '@/lib/style'
import type { AlbumMapCover } from './lib/album-map-data'

export function AlbumMapCoverImage({
  cover,
  alt = '',
  loading = 'lazy',
  scaleOnHover = false,
}: {
  cover: AlbumMapCover
  alt?: string
  loading?: 'eager' | 'lazy'
  scaleOnHover?: boolean
}) {
  return (
    <ThumbnailImage
      photo={{
        thumbHash: cover.thumbHash,
        thumbnail: {
          url: cover.url,
          width: cover.width,
          height: cover.height,
        },
      }}
      alt={alt}
      loading={loading}
      imageClassName={cn(
        'pointer-events-none select-none',
        scaleOnHover &&
          'transition-transform duration-300 ease-out group-hover:scale-105',
      )}
      placeholderClassName="pointer-events-none select-none"
    />
  )
}
