import Image, { type ImageProps } from 'next/image'
import { ThumbHashImage } from '@/components/thumbhash'
import type { PhotoAsset } from '@/lib/photo'
import { cn } from '@/lib/style'

export interface ThumbnailImagePhoto {
  thumbHash: string
  thumbnail: Pick<PhotoAsset, 'height' | 'url' | 'width'>
}

interface ThumbnailImageProps {
  photo: ThumbnailImagePhoto
  alt?: string
  fetchPriority?: ImageProps['fetchPriority']
  fit?: 'contain' | 'cover'
  loadImage?: boolean
  loading?: 'eager' | 'lazy'
  onError?: ImageProps['onError']
  onLoad?: ImageProps['onLoad']
  scaleOnHover?: boolean
}

export function ThumbnailImage({
  photo,
  alt = '',
  fetchPriority,
  fit = 'cover',
  loadImage = true,
  loading = 'lazy',
  onError,
  onLoad,
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
      {loadImage ? (
        <Image
          src={photo.thumbnail.url}
          alt={alt}
          width={photo.thumbnail.width}
          height={photo.thumbnail.height}
          className={cn('absolute inset-0 size-full', imageFitClassName)}
          decoding="auto"
          fetchPriority={fetchPriority}
          loading={loading}
          onError={onError}
          onLoad={onLoad}
          unoptimized
        />
      ) : null}
    </span>
  )
}
