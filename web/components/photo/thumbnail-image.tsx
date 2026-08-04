'use client'

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
  const handleImageRef = (image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth > 0) {
      image.dataset.loaded = 'true'
    }
  }

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
        key={photo.thumbnail.url}
        ref={handleImageRef}
        src={photo.thumbnail.url}
        alt={alt}
        width={photo.thumbnail.width}
        height={photo.thumbnail.height}
        className={cn(
          'absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-200 ease-out data-loaded:opacity-100 motion-reduce:transition-none',
          imageClassName,
        )}
        decoding="async"
        loading={loading}
        unoptimized
        onLoad={(event) => {
          event.currentTarget.dataset.loaded = 'true'
        }}
      />
    </>
  )
}
