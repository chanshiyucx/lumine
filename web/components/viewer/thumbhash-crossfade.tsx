import { useEffect, useRef, useState } from 'react'
import { ThumbHashImage } from '@/components/thumbhash'
import { cn } from '@/lib/style'

interface BackgroundLayer {
  key: number
  photoId: string
  thumbHash: string
  animate: boolean
}

interface ThumbHashCrossfadeProps {
  photoId: string
  thumbHash: string
  imageClassName?: string
}

export function ThumbHashCrossfade({
  photoId,
  thumbHash,
  imageClassName,
}: ThumbHashCrossfadeProps) {
  const nextKeyRef = useRef(1)
  const [layers, setLayers] = useState<BackgroundLayer[]>([
    { key: 0, photoId, thumbHash, animate: false },
  ])

  useEffect(() => {
    setLayers((current) => {
      const latest = current.at(-1)

      if (latest?.photoId === photoId && latest.thumbHash === thumbHash) {
        return current
      }

      const nextLayer = {
        key: nextKeyRef.current,
        photoId,
        thumbHash,
        animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      }
      nextKeyRef.current += 1

      return nextLayer.animate ? [...current, nextLayer] : [nextLayer]
    })
  }, [photoId, thumbHash])

  const handleAnimationEnd = (key: number) => {
    setLayers((current) => {
      const latest = current.at(-1)

      return latest?.key === key && current.length > 1 ? [latest] : current
    })
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {layers.map((layer) => (
        <ThumbHashImage
          key={layer.key}
          thumbHash={layer.thumbHash}
          className={cn(
            'absolute inset-0 size-full',
            imageClassName,
            layer.animate && 'animate-thumbhash-crossfade-enter',
          )}
          onAnimationEnd={() => handleAnimationEnd(layer.key)}
        />
      ))}
    </div>
  )
}
