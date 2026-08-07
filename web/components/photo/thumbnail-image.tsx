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
  imageClassName?: string
  loadImage?: boolean
  loading?: 'eager' | 'lazy'
  onError?: ImageProps['onError']
  onLoad?: ImageProps['onLoad']
  placeholderClassName?: string
}

export function ThumbnailImage({
  photo,
  alt = '',
  fetchPriority,
  imageClassName,
  loadImage = true,
  loading = 'lazy',
  onError,
  onLoad,
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
      {loadImage ? (
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
          fetchPriority={fetchPriority}
          loading={loading}
          onError={onError}
          onLoad={onLoad}
          unoptimized
        />
      ) : null}
    </>
  )
}
