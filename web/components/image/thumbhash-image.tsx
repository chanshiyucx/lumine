import Image from 'next/image'
import { getThumbHashDataUrl } from '@/lib/thumbhash'

// Decodes the hash in the browser, or shows a placeholder the server already rendered.
type ThumbHashImageProps = { className?: string } & (
  | { thumbHash: string; placeholderSrc?: never }
  | { thumbHash?: never; placeholderSrc: string }
)

export function ThumbHashImage({ className, ...source }: ThumbHashImageProps) {
  // Check the value, not the key, so an explicit `undefined` still decodes the hash.
  const src =
    source.placeholderSrc === undefined
      ? getThumbHashDataUrl(source.thumbHash)
      : source.placeholderSrc

  return (
    <Image
      src={src}
      alt=""
      aria-hidden="true"
      className={className}
      decoding="async"
      fill
      unoptimized
    />
  )
}
