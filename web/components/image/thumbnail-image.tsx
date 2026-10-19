import Image from 'next/image'
import type { PhotoAsset } from '@/lib/photo'
import { cn } from '@/lib/style'
import { ThumbHashImage } from './thumbhash-image'

export interface ThumbnailImagePhoto {
  thumbHash: string
  thumbnail: Pick<PhotoAsset, 'height' | 'url' | 'width'>
}

interface ThumbnailImageProps {
  photo: ThumbnailImagePhoto
  fit?: 'contain' | 'cover'
  loading?: 'eager' | 'lazy'
  showPlaceholder?: boolean
}

export function ThumbnailImage({
  photo,
  fit = 'cover',
  loading = 'lazy',
  showPlaceholder = true,
}: ThumbnailImageProps) {
  const placeholderFitClassName =
    fit === 'contain' ? 'object-fill' : 'object-cover'
  const imageFitClassName =
    fit === 'contain' ? 'object-contain' : 'object-cover'

  return (
    <span className="pointer-events-none absolute inset-0 block select-none">
      {showPlaceholder && (
        <ThumbHashImage
          thumbHash={photo.thumbHash}
          className={placeholderFitClassName}
        />
      )}
      <Image
        src={photo.thumbnail.url}
        alt=""
        aria-hidden
        width={photo.thumbnail.width}
        height={photo.thumbnail.height}
        className={cn('absolute inset-0 size-full', imageFitClassName)}
        decoding="auto"
        draggable={false}
        loading={loading}
        unoptimized
      />
    </span>
  )
}
