import Image from 'next/image'
import { ThumbHashImage } from '@/components/thumbhash'
import type { PhotoAsset } from '@/lib/photo'
import { cn } from '@/lib/style'

export interface ThumbnailImagePhoto {
  thumbHash: string
  thumbnail: Pick<PhotoAsset, 'height' | 'url' | 'width'>
}

interface ThumbnailImageProps {
  photo: ThumbnailImagePhoto
  fit?: 'contain' | 'cover'
  loading?: 'eager' | 'lazy'
  scaleOnHover?: boolean
}

export function ThumbnailImage({
  photo,
  fit = 'cover',
  loading = 'lazy',
  scaleOnHover = false,
}: ThumbnailImageProps) {
  const placeholderFitClassName =
    fit === 'contain' ? 'object-fill' : 'object-cover'
  const imageFitClassName =
    fit === 'contain' ? 'object-contain' : 'object-cover'

  return (
    <span
      className={cn(
        'pointer-events-none absolute inset-0 block select-none',
        scaleOnHover &&
          'transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100',
      )}
    >
      <ThumbHashImage
        thumbHash={photo.thumbHash}
        className={placeholderFitClassName}
      />
      <Image
        src={photo.thumbnail.url}
        alt=""
        width={photo.thumbnail.width}
        height={photo.thumbnail.height}
        className={cn('absolute inset-0 size-full', imageFitClassName)}
        decoding="auto"
        loading={loading}
        unoptimized
      />
    </span>
  )
}
