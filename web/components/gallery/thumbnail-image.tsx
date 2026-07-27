'use client'

/* eslint-disable @next/next/no-img-element */
import { useCallback } from 'react'
import { ThumbHashImage } from '@/components/thumbhash'
import type { PhotoAsset } from '@/lib/photos'
import { cn } from '@/lib/style'

interface ThumbnailImagePhoto {
  title: string
  thumbHash: string
  thumbnail: Pick<PhotoAsset, 'height' | 'url' | 'width'>
}

interface ThumbnailImageProps {
  photo: ThumbnailImagePhoto
  decorative?: boolean
  imageClassName?: string
  loading?: 'eager' | 'lazy'
  placeholderClassName?: string
}

export function ThumbnailImage({
  photo,
  decorative = false,
  imageClassName,
  loading = 'lazy',
  placeholderClassName,
}: ThumbnailImageProps) {
  const handleImageRef = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth > 0) {
      image.dataset.loaded = 'true'
    }
  }, [])

  return (
    <>
      <ThumbHashImage
        thumbHash={photo.thumbHash}
        className={cn(
          'absolute inset-0 h-full w-full object-cover',
          placeholderClassName,
        )}
      />
      <img
        key={photo.thumbnail.url}
        ref={handleImageRef}
        src={photo.thumbnail.url}
        alt={decorative ? '' : photo.title}
        aria-hidden={decorative || undefined}
        width={photo.thumbnail.width}
        height={photo.thumbnail.height}
        className={cn(
          'absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-200 ease-out data-[loaded=true]:opacity-100 motion-reduce:transition-none',
          imageClassName,
        )}
        decoding="async"
        loading={loading}
        onLoad={(event) => {
          event.currentTarget.dataset.loaded = 'true'
        }}
      />
    </>
  )
}
