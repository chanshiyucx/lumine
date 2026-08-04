'use client'

import Image, { type ImageProps } from 'next/image'
import { getThumbHashAsset } from '@/lib/thumbhash'

interface ThumbHashImageProps extends Omit<
  ImageProps,
  'alt' | 'fill' | 'height' | 'src' | 'width'
> {
  thumbHash: string
}

export function ThumbHashImage({ thumbHash, ...props }: ThumbHashImageProps) {
  const src = getThumbHashAsset(thumbHash).dataUrl

  return (
    <Image
      {...props}
      src={src}
      alt=""
      aria-hidden
      decoding="async"
      fill
      sizes="100vw"
      unoptimized
    />
  )
}
