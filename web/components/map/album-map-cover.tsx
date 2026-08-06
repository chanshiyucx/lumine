import { ThumbnailImage } from '@/components/photo'
import type { AlbumMapCover } from '@/lib/map/album-map-data'

export function AlbumMapCoverImage({
  cover,
  alt = '',
  loading = 'lazy',
}: {
  cover: AlbumMapCover
  alt?: string
  loading?: 'eager' | 'lazy'
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
      imageClassName="pointer-events-none select-none transition-transform duration-300 group-hover:scale-105"
      placeholderClassName="pointer-events-none select-none"
    />
  )
}
