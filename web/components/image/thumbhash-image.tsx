import Image from 'next/image'
import { getThumbHashDataUrl } from '@/lib/thumbhash'

interface ThumbHashImageProps {
  thumbHash: string
  placeholderSrc?: string
  className?: string
}

export function ThumbHashImage({
  thumbHash,
  placeholderSrc,
  className,
}: ThumbHashImageProps) {
  const src = placeholderSrc ?? getThumbHashDataUrl(thumbHash)

  return (
    <Image
      src={src}
      alt=""
      aria-hidden
      className={className}
      decoding="async"
      fill
      sizes="100vw"
      unoptimized
    />
  )
}
