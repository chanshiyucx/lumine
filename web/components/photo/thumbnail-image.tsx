import Image from 'next/image'
import { ThumbHashImage } from '@/components/thumbhash'
import type { PhotoAsset } from '@/lib/photo'
import { cn } from '@/lib/style'

interface ThumbnailImagePhoto {
  thumbHash: string
  thumbnail: Pick<PhotoAsset, 'height' | 'url' | 'width'>
}

interface ThumbnailImageProps {
  photo: ThumbnailImagePhoto
  alt?: string
  imageClassName?: string
  loading?: 'eager' | 'lazy'
  placeholderClassName?: string
}

export function ThumbnailImage({
  photo,
  alt = '',
  imageClassName,
  loading = 'lazy',
  placeholderClassName,
}: ThumbnailImageProps) {
  return (
    <>
      <ThumbHashImage
        thumbHash={photo.thumbHash}
        className={cn(
          'absolute inset-0 size-full object-cover',
          placeholderClassName,
        )}
      />
      <Image
        src={photo.thumbnail.url}
        alt={alt}
        width={photo.thumbnail.width}
        height={photo.thumbnail.height}
        className={cn(
          'absolute inset-0 size-full object-cover',
          imageClassName,
        )}
        decoding="async"
        loading={loading}
        unoptimized
      />
    </>
  )
}
