import 'server-only'
import sharp from 'sharp'
import { thumbHashToRGBA } from 'thumbhash'
import { ThumbHashImage } from '@/components/thumbhash'

interface ServerThumbHashImageProps {
  thumbHash: string
  className?: string
}

export async function ServerThumbHashImage({
  thumbHash,
  className,
}: ServerThumbHashImageProps) {
  const { w, h, rgba } = thumbHashToRGBA(Buffer.from(thumbHash, 'base64'))
  const png = await sharp(rgba, {
    raw: { width: w, height: h, channels: 4 },
  })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()

  return (
    <ThumbHashImage
      thumbHash={thumbHash}
      placeholderSrc={`data:image/png;base64,${png.toString('base64')}`}
      className={className}
    />
  )
}
