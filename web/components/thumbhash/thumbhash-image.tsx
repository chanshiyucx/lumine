'use client'

/* eslint-disable @next/next/no-img-element */
import { useMemo, type ComponentProps } from 'react'
import { getThumbHashAsset } from '@/lib/thumbhash'

interface ThumbHashImageProps extends Omit<
  ComponentProps<'img'>,
  'alt' | 'src'
> {
  thumbHash: string
}

export function ThumbHashImage({ thumbHash, ...props }: ThumbHashImageProps) {
  const src = useMemo(() => getThumbHashAsset(thumbHash).dataUrl, [thumbHash])

  return <img {...props} src={src} alt="" aria-hidden decoding="async" />
}
