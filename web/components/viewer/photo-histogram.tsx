'use client'

import { useEffect, useRef, useState } from 'react'
import type { Photo } from '@/lib/photo'
import { cn } from '@/lib/style'

const BIN_COUNT = 128
const MAX_HISTOGRAM_CACHE_SIZE = 50
const HISTOGRAM_ANIMATION_DURATION_MS = 750
const HISTOGRAM_ANIMATION_REST_DELTA = 0.001

type Channel = 'red' | 'green' | 'blue' | 'luminance'
type HistogramBins = Record<Channel, number[]>

const histogramCache = new Map<string, HistogramBins>()

const CHANNEL_CONFIG: Record<Channel, { alpha: number; rgb: string }> = {
  red: { alpha: 0.75, rgb: '235, 111, 146' }, // Rose Pine Love
  green: { alpha: 0.75, rgb: '156, 207, 216' }, // Rose Pine Foam
  blue: { alpha: 0.75, rgb: '196, 167, 231' }, // Rose Pine Iris
  luminance: { alpha: 0.28, rgb: '224, 222, 244' }, // Rose Pine Text
}

function calculateHistogram(imageData: ImageData): HistogramBins {
  const bins: HistogramBins = {
    blue: new Array<number>(BIN_COUNT).fill(0),
    green: new Array<number>(BIN_COUNT).fill(0),
    luminance: new Array<number>(BIN_COUNT).fill(0),
    red: new Array<number>(BIN_COUNT).fill(0),
  }

  const { data } = imageData
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0
    const g = data[i + 1] ?? 0
    const b = data[i + 2] ?? 0

    bins.red[r >> 1] = (bins.red[r >> 1] ?? 0) + 1
    bins.green[g >> 1] = (bins.green[g >> 1] ?? 0) + 1
    bins.blue[b >> 1] = (bins.blue[b >> 1] ?? 0) + 1

    const luminance = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)
    bins.luminance[luminance >> 1] = (bins.luminance[luminance >> 1] ?? 0) + 1
  }

  return bins
}

function calculateSpringProgress(
  tSec: number,
  frequency = 8,
  damping = 7,
): number {
  const exp = Math.exp(-damping * tSec)
  const value =
    1 -
    exp *
      (Math.cos(frequency * tSec) +
        (damping / frequency) * Math.sin(frequency * tSec))

  return Math.max(0, Math.min(1, value))
}

function lerpArray(from: number[], to: number[], progress: number): number[] {
  return from.map(
    (value, index) => value + ((to[index] ?? 0) - value) * progress,
  )
}

function cacheHistogram(key: string, bins: HistogramBins): void {
  if (histogramCache.size >= MAX_HISTOGRAM_CACHE_SIZE) {
    const oldestKey = histogramCache.keys().next().value
    if (oldestKey) {
      histogramCache.delete(oldestKey)
    }
  }
  histogramCache.set(key, bins)
}

interface PhotoHistogramProps {
  className?: string
  photo: Photo
}

export function PhotoHistogram({ className, photo }: PhotoHistogramProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const previousHistogramRef = useRef<HistogramBins | null>(null)
  const currentVisualHistogramRef = useRef<HistogramBins | null>(null)
  const animationRef = useRef<number | null>(null)
  const [histogram, setHistogram] = useState<HistogramBins | null>(() => {
    return histogramCache.get(photo.thumbnail.url) ?? null
  })
  const [dimensions, setDimensions] = useState<{
    height: number
    width: number
  }>({
    height: 0,
    width: 0,
  })

  // 1. Observe container size safely without layout thrashing
  useEffect(() => {
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
  }, [])

  // 2. Fetch and sample image data with in-memory caching and AbortController
  useEffect(() => {
    const cacheKey = photo.thumbnail.url
    const cachedBins = histogramCache.get(cacheKey)

    if (cachedBins) {
      setHistogram(cachedBins)
      return
    }

    const controller = new AbortController()

    async function loadHistogram() {
      try {
        const response = await fetch(cacheKey, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`Failed to fetch thumbnail: ${response.status}`)
        }

        const blob = await response.blob()
        if (controller.signal.aborted) {
          return
        }

        let imageSource: CanvasImageSource

        if (typeof createImageBitmap === 'function') {
          imageSource = await createImageBitmap(blob)
        } else {
          const objectUrl = URL.createObjectURL(blob)
          const img = new Image()
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = () => reject(new Error('Failed to decode image'))
            img.src = objectUrl
          })
          URL.revokeObjectURL(objectUrl)
          imageSource = img
        }

        if (controller.signal.aborted) {
          if (
            typeof ImageBitmap !== 'undefined' &&
            imageSource instanceof ImageBitmap
          ) {
            imageSource.close()
          }
          return
        }

        const sourceWidth =
          'width' in imageSource ? Number(imageSource.width) : 240
        const sourceHeight =
          'height' in imageSource ? Number(imageSource.height) : 160

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          return
        }

        const maxSize = 240
        const scale = Math.min(1, maxSize / sourceWidth, maxSize / sourceHeight)
        const scaledWidth = Math.max(1, Math.floor(sourceWidth * scale))
        const scaledHeight = Math.max(1, Math.floor(sourceHeight * scale))

        canvas.width = scaledWidth
        canvas.height = scaledHeight
        ctx.drawImage(imageSource, 0, 0, scaledWidth, scaledHeight)

        if (
          typeof ImageBitmap !== 'undefined' &&
          imageSource instanceof ImageBitmap
        ) {
          imageSource.close()
        }

        const imageData = ctx.getImageData(0, 0, scaledWidth, scaledHeight)
        const bins = calculateHistogram(imageData)

        if (!controller.signal.aborted) {
          cacheHistogram(cacheKey, bins)
          setHistogram(bins)
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('Failed to compute histogram:', error)
        }
      }
    }

    void loadHistogram()

    return () => {
      controller.abort()
    }
  }, [photo.thumbnail.url])

  // 3. High-performance canvas rendering with Spring physics interpolation
  useEffect(() => {
    const canvas = canvasRef.current
    if (
      !canvas ||
      !histogram ||
      dimensions.width <= 0 ||
      dimensions.height <= 0
    ) {
      return
    }

    const { height, width } = dimensions
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)

    const renderHistogram = (data: HistogramBins) => {
      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, width, height)

      // Draw subtle exposure reference lines at 25%, 50%, 75%
      ctx.strokeStyle = 'rgba(224, 222, 244, 0.04)'
      ctx.lineWidth = 0.5
      for (let i = 1; i <= 3; i++) {
        const y = (height / 4) * i
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      const maxVal = Math.max(
        ...data.luminance,
        ...data.red,
        ...data.green,
        ...data.blue,
      )

      if (maxVal > 0) {
        const drawChannel = (bins: number[], rgb: string, alpha: number) => {
          const gradient = ctx.createLinearGradient(0, 0, 0, height)
          gradient.addColorStop(0, `rgba(${rgb}, ${alpha})`)
          gradient.addColorStop(1, `rgba(${rgb}, ${alpha * 0.08})`)
          ctx.fillStyle = gradient

          const barWidth = width / BIN_COUNT
          const barSpacing = Math.max(1, barWidth * 0.85)

          for (let i = 0; i < bins.length; i++) {
            const val = bins[i] ?? 0
            if (val <= 0) {
              continue
            }
            const barHeight = (val / maxVal) * height
            ctx.fillRect(
              i * barWidth,
              height - barHeight,
              barSpacing,
              barHeight,
            )
          }
        }

        // Draw luminance backdrop
        drawChannel(
          data.luminance,
          CHANNEL_CONFIG.luminance.rgb,
          CHANNEL_CONFIG.luminance.alpha,
        )

        // Blend Red, Green, Blue with screen composition
        ctx.globalCompositeOperation = 'screen'
        drawChannel(data.red, CHANNEL_CONFIG.red.rgb, CHANNEL_CONFIG.red.alpha)
        drawChannel(
          data.green,
          CHANNEL_CONFIG.green.rgb,
          CHANNEL_CONFIG.green.alpha,
        )
        drawChannel(
          data.blue,
          CHANNEL_CONFIG.blue.rgb,
          CHANNEL_CONFIG.blue.alpha,
        )
        ctx.globalCompositeOperation = 'source-over'
      }

      // Top ambient light sheen
      const highlight = ctx.createLinearGradient(0, 0, 0, height * 0.25)
      highlight.addColorStop(0, 'rgba(224, 222, 244, 0.03)')
      highlight.addColorStop(1, 'rgba(224, 222, 244, 0)')
      ctx.fillStyle = highlight
      ctx.fillRect(0, 0, width, height * 0.25)
      ctx.restore()
    }

    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    const startFromHistogram =
      currentVisualHistogramRef.current ?? previousHistogramRef.current

    if (!startFromHistogram) {
      renderHistogram(histogram)
      previousHistogramRef.current = histogram
      currentVisualHistogramRef.current = histogram
      return
    }

    const startAt = performance.now()

    const animate = (now: number) => {
      const elapsedMs = now - startAt
      const progress = calculateSpringProgress(elapsedMs / 1000)

      const interpolated: HistogramBins = {
        blue: lerpArray(startFromHistogram.blue, histogram.blue, progress),
        green: lerpArray(startFromHistogram.green, histogram.green, progress),
        luminance: lerpArray(
          startFromHistogram.luminance,
          histogram.luminance,
          progress,
        ),
        red: lerpArray(startFromHistogram.red, histogram.red, progress),
      }

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
  }, [dimensions, histogram])

  return (
    <div
      ref={containerRef}
      className={cn(
        'bg-text/10 relative h-20 w-full min-w-0 overflow-hidden rounded-md',
        className,
      )}
      role="img"
      aria-label="Photo RGB and luminance histogram"
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
    </div>
  )
}
