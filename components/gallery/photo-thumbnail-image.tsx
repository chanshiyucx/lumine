/* eslint-disable @next/next/no-img-element */
import type { Ref } from 'react'
import type { GalleryPhoto } from '@/lib/photos'
import { cn } from '@/lib/style'

interface PhotoThumbnailImageProps {
  photo: Pick<GalleryPhoto, 'alt' | 'blurDataUrl' | 'thumbnail'>
  alt?: string
  ariaHidden?: boolean
  blurClassName?: string
  imageHidden?: boolean
  imageClassName?: string
  imageRef?: Ref<HTMLImageElement>
  loading?: 'eager' | 'lazy'
  draggable?: boolean
  onError?: () => void
  onLoad?: () => void
}

export function PhotoThumbnailImage({
  photo,
  alt,
  ariaHidden = false,
  blurClassName,
  imageHidden = false,
  imageClassName,
  imageRef,
  loading = 'lazy',
  draggable = false,
  onError,
  onLoad,
}: PhotoThumbnailImageProps) {
  return (
    <>
      <img
        src={photo.blurDataUrl}
        alt=""
        aria-hidden
        className={cn(
          'absolute inset-0 h-full w-full object-cover',
          blurClassName,
        )}
      />
      {!imageHidden ? (
        <img
          ref={imageRef}
          src={photo.thumbnail.url}
          alt={ariaHidden ? '' : (alt ?? photo.alt)}
          aria-hidden={ariaHidden}
          className={imageClassName}
          loading={loading}
          draggable={draggable}
          onLoad={onLoad}
          onError={onError}
        />
      ) : null}
    </>
  )
}
