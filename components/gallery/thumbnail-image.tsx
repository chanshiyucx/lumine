/* eslint-disable @next/next/no-img-element */
import type { Ref } from 'react'
import type { Photo } from '@/lib/photos'
import { cn } from '@/lib/style'

interface ThumbnailImageProps {
  photo: Pick<Photo, 'title' | 'blurDataUrl' | 'thumbnail'>
  blurClassName?: string
  imageClassName?: string
  imageRef?: Ref<HTMLImageElement>
  loading?: 'eager' | 'lazy'
}

export function ThumbnailImage({
  photo,
  blurClassName,
  imageClassName,
  imageRef,
  loading = 'lazy',
}: ThumbnailImageProps) {
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
      <img
        ref={imageRef}
        src={photo.thumbnail.url}
        alt={photo.title}
        className={imageClassName}
        loading={loading}
      />
    </>
  )
}
