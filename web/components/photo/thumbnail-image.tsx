'use client'

import Image, { type ImageProps } from 'next/image'
import { useState } from 'react'
import { ThumbHashImage } from '@/components/thumbhash'
import type { PhotoAsset } from '@/lib/photo'
import { cn } from '@/lib/style'

const loadedThumbnailUrls = new Set<string>()

export interface ThumbnailImagePhoto {
  thumbHash: string
  thumbnail: Pick<PhotoAsset, 'height' | 'url' | 'width'>
}

interface ThumbnailImageProps {
  photo: ThumbnailImagePhoto
  alt?: string
  fadeIn?: boolean
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
  fadeIn = true,
  fetchPriority,
  fit = 'cover',
  loadImage = true,
  loading = 'lazy',
  onError,
  onLoad,
  scaleOnHover = false,
}: ThumbnailImageProps) {
  const thumbnailUrl = photo.thumbnail.url
  const [loadedUrl, setLoadedUrl] = useState<string | null>(() =>
    loadedThumbnailUrls.has(thumbnailUrl) ? thumbnailUrl : null,
  )
  const isLoaded =
    !fadeIn ||
    loadedUrl === thumbnailUrl ||
    loadedThumbnailUrls.has(thumbnailUrl)
  const placeholderFitClassName =
    fit === 'contain' ? 'object-fill' : 'object-cover'
  const imageFitClassName =
    fit === 'contain' ? 'object-contain' : 'object-cover'

  const handleLoad: NonNullable<ImageProps['onLoad']> = (event) => {
    loadedThumbnailUrls.add(thumbnailUrl)
    setLoadedUrl(thumbnailUrl)
    onLoad?.(event)
  }

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
          key={thumbnailUrl}
          src={thumbnailUrl}
          alt={alt}
          width={photo.thumbnail.width}
          height={photo.thumbnail.height}
          className={cn(
            'absolute inset-0 size-full',
            imageFitClassName,
            fadeIn &&
              'transition-opacity duration-300 ease-out motion-reduce:transition-none',
            isLoaded ? 'opacity-100' : 'opacity-0',
          )}
          decoding="async"
          fetchPriority={fetchPriority}
          loading={loading}
          onError={onError}
          onLoad={handleLoad}
          unoptimized
        />
      ) : null}
    </span>
  )
}
