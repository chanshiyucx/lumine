import { ThumbnailImage } from '@/components/photo'
import type { AlbumMapCover } from './lib/album-map-data'

export function AlbumMapCoverImage({
  cover,
  alt = '',
  fadeIn = true,
  loading = 'lazy',
  scaleOnHover = false,
}: {
  cover: AlbumMapCover
  alt?: string
  fadeIn?: boolean
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
      fadeIn={fadeIn}
      loading={loading}
      scaleOnHover={scaleOnHover}
    />
  )
}
