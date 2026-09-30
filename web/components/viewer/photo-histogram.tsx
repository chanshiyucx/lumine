'use client'

import { useEffect, useRef, useState } from 'react'
import type { Photo } from '@/lib/photo'
import { cn } from '@/lib/style'
import {
  calculateSpringProgress,
  copyHistogram,
  createHistogramRenderer,
  interpolateHistogram,
} from './lib/histogram-renderer'
import {
  createHistogramBins,
  getHistogram,
  peekHistogram,
  type HistogramBins,
} from './lib/photo-histogram'

const HISTOGRAM_ANIMATION_DURATION_MS = 750
const HISTOGRAM_ANIMATION_REST_DELTA = 0.001

interface DisplayedHistogram {
  bins: HistogramBins
  key: string
}

interface PhotoHistogramProps {
  className?: string
  isActive: boolean
  photo: Photo
}

export function PhotoHistogram({
  className,
  isActive,
  photo,
}: PhotoHistogramProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const previousHistogramRef = useRef<HistogramBins | null>(null)
  const currentVisualHistogramRef = useRef<HistogramBins | null>(null)
  const animationStartHistogramRef = useRef<HistogramBins | null>(null)
  const interpolationBufferRef = useRef<HistogramBins | null>(null)
  const animationRef = useRef<number | null>(null)
  const [displayedHistogram, setDisplayedHistogram] =
    useState<DisplayedHistogram | null>(() => {
      const key = photo.thumbnail.url
      const bins = peekHistogram(key)
      return bins ? { bins, key } : null
    })
  const histogram = displayedHistogram?.bins ?? null
  const [dimensions, setDimensions] = useState<{
    height: number
    width: number
  }>({
    height: 0,
    width: 0,
  })

  useEffect(() => {
    if (!isActive) {
      return
    }

    const container = containerRef.current
    if (!container) {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) {
        return
      }

      const width = Math.floor(entry.contentRect.width)
      const height = Math.floor(entry.contentRect.height)

      if (width > 0 && height > 0) {
        setDimensions((prev) => {
          if (prev.width === width && prev.height === height) {
            return prev
          }
          return { height, width }
        })
      }
    })

    observer.observe(container)

    return () => observer.disconnect()
  }, [isActive])

  useEffect(() => {
    if (!isActive) {
      return
    }

    const cacheKey = photo.thumbnail.url
    let isCurrent = true

    void getHistogram(cacheKey).then(
      (bins) => {
        if (!isCurrent) {
          return
        }

        setDisplayedHistogram((current) =>
          current?.key === cacheKey && current.bins === bins
            ? current
            : { bins, key: cacheKey },
        )
      },
      (error: unknown) => {
        if (!isCurrent) {
          return
        }

        setDisplayedHistogram((current) =>
          current?.key === cacheKey ? current : null,
        )
        console.error('Failed to compute histogram:', error)
      },
    )

    return () => {
      isCurrent = false
    }
  }, [isActive, photo.thumbnail.url])

  useEffect(() => {
    if (!isActive) {
      previousHistogramRef.current = histogram
      currentVisualHistogramRef.current = histogram
      return
    }

    const canvas = canvasRef.current
    if (
      !canvas ||
      !histogram ||
      dimensions.width <= 0 ||
      dimensions.height <= 0
    ) {
      return
    }

    const renderHistogram = createHistogramRenderer(canvas, dimensions)
    if (!renderHistogram) {
      return
    }

    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    const currentStartHistogram =
      currentVisualHistogramRef.current ?? previousHistogramRef.current

    if (!currentStartHistogram || previousHistogramRef.current === histogram) {
      renderHistogram(histogram)
      previousHistogramRef.current = histogram
      currentVisualHistogramRef.current = histogram
      return
    }

    const animationStartHistogram = copyHistogram(
      currentStartHistogram,
      animationStartHistogramRef.current ?? createHistogramBins(),
    )
    animationStartHistogramRef.current = animationStartHistogram
    const interpolationBuffer =
      interpolationBufferRef.current ?? createHistogramBins()
    interpolationBufferRef.current = interpolationBuffer
    const startAt = performance.now()

    const animate = (now: number) => {
      const elapsedMs = now - startAt
      const progress = calculateSpringProgress(elapsedMs / 1000)

      const interpolated = interpolateHistogram(
        animationStartHistogram,
        histogram,
        progress,
        interpolationBuffer,
      )

      currentVisualHistogramRef.current = interpolated
      renderHistogram(interpolated)

      const isCompleted =
        Math.abs(1 - progress) < HISTOGRAM_ANIMATION_REST_DELTA ||
        elapsedMs >= HISTOGRAM_ANIMATION_DURATION_MS

      if (!isCompleted) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        renderHistogram(histogram)
        previousHistogramRef.current = histogram
        currentVisualHistogramRef.current = histogram
        animationRef.current = null
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
  }, [dimensions, histogram, isActive])

  return (
    <div
      ref={containerRef}
      className={cn(
        'bg-text/10 relative h-32 w-full min-w-0 overflow-hidden rounded-md',
        className,
      )}
      role="img"
      aria-label="Photo RGB and luminance histogram"
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
    </div>
  )
}
