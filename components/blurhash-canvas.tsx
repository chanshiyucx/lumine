'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { decodeBlurhash } from '@/lib/blurhash'
import { cn } from '@/lib/utils'

interface BlurhashCanvasProps {
  hash: string
  className?: string
  width?: number
  height?: number
  style?: CSSProperties
}

export function BlurhashCanvas({
  hash,
  className,
  width = 32,
  height = 32,
  style,
}: BlurhashCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d')

    if (!context) {
      return
    }

    try {
      const pixels = decodeBlurhash(hash, width, height)
      const imageData = new ImageData(pixels, width, height)

      context.putImageData(imageData, 0, 0)
    } catch {
      context.clearRect(0, 0, width, height)
    }
  }, [hash, height, width])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={cn('h-full w-full', className)}
      style={style}
      aria-hidden
    />
  )
}
