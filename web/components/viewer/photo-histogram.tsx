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
interface DisplayedHistogram {
  bins: HistogramBins
  key: string
}

const histogramCache = new Map<string, HistogramBins>()
const histogramRequests = new Map<string, Promise<HistogramBins>>()
const CHANNELS: readonly Channel[] = ['luminance', 'red', 'green', 'blue']

const CHANNEL_CONFIG: Record<Channel, { alpha: number; rgb: string }> = {
  red: { alpha: 0.75, rgb: '235, 111, 146' }, // Rose Pine Love
  green: { alpha: 0.75, rgb: '156, 207, 216' }, // Rose Pine Foam
  blue: { alpha: 0.75, rgb: '196, 167, 231' }, // Rose Pine Iris
  luminance: { alpha: 0.28, rgb: '224, 222, 244' }, // Rose Pine Text
}

function createHistogramBins(): HistogramBins {
  return {
    blue: new Array<number>(BIN_COUNT).fill(0),
    green: new Array<number>(BIN_COUNT).fill(0),
    luminance: new Array<number>(BIN_COUNT).fill(0),
    red: new Array<number>(BIN_COUNT).fill(0),
  }
}

function calculateHistogram(imageData: ImageData): HistogramBins {
  const bins = createHistogramBins()

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

function copyHistogram(from: HistogramBins, to: HistogramBins): HistogramBins {
  for (const channel of CHANNELS) {
    const sourceBins = from[channel]
    const targetBins = to[channel]
    for (let index = 0; index < BIN_COUNT; index++) {
      targetBins[index] = sourceBins[index] ?? 0
    }
  }

  return to
}

function interpolateHistogram(
  from: HistogramBins,
  to: HistogramBins,
  progress: number,
  output: HistogramBins,
): HistogramBins {
  for (const channel of CHANNELS) {
    const fromBins = from[channel]
    const toBins = to[channel]
    const outputBins = output[channel]
    for (let index = 0; index < BIN_COUNT; index++) {
      const fromValue = fromBins[index] ?? 0
      outputBins[index] =
        fromValue + ((toBins[index] ?? 0) - fromValue) * progress
    }
  }

  return output
}

function cacheHistogram(key: string, bins: HistogramBins): void {
  histogramCache.delete(key)
  if (histogramCache.size >= MAX_HISTOGRAM_CACHE_SIZE) {
    const oldestKey = histogramCache.keys().next().value
    if (oldestKey) {
      histogramCache.delete(oldestKey)
    }
  }
  histogramCache.set(key, bins)
}

function getCachedHistogram(key: string): HistogramBins | null {
  const bins = histogramCache.get(key)
  if (!bins) {
    return null
  }

  histogramCache.delete(key)
  histogramCache.set(key, bins)
  return bins
}

async function computeHistogram(key: string): Promise<HistogramBins> {
  const response = await fetch(key)
  if (!response.ok) {
    throw new Error(`Failed to fetch thumbnail: ${response.status}`)
  }

  const blob = await response.blob()
  let imageBitmap: ImageBitmap | null = null
  let imageSource: ImageBitmap | HTMLImageElement

  if (typeof createImageBitmap === 'function') {
    imageBitmap = await createImageBitmap(blob)
    imageSource = imageBitmap
  } else {
    const objectUrl = URL.createObjectURL(blob)
    const image = new Image()

    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('Failed to decode image'))
        image.src = objectUrl
      })
    } finally {
      URL.revokeObjectURL(objectUrl)
    }

    imageSource = image
  }

  try {
    const sourceWidth =
      imageSource instanceof HTMLImageElement
        ? imageSource.naturalWidth
        : imageSource.width
    const sourceHeight =
      imageSource instanceof HTMLImageElement
        ? imageSource.naturalHeight
        : imageSource.height
    const maxSize = 240
    const scale = Math.min(1, maxSize / sourceWidth, maxSize / sourceHeight)
    const scaledWidth = Math.max(1, Math.floor(sourceWidth * scale))
    const scaledHeight = Math.max(1, Math.floor(sourceHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = scaledWidth
    canvas.height = scaledHeight

    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      throw new Error('Failed to create histogram canvas context')
    }

    context.drawImage(imageSource, 0, 0, scaledWidth, scaledHeight)
    return calculateHistogram(
      context.getImageData(0, 0, scaledWidth, scaledHeight),
    )
  } finally {
    imageBitmap?.close()
  }
}

function getHistogram(key: string): Promise<HistogramBins> {
  const cachedBins = getCachedHistogram(key)
  if (cachedBins) {
    return Promise.resolve(cachedBins)
  }

  const pendingRequest = histogramRequests.get(key)
  if (pendingRequest) {
    return pendingRequest
  }

  const request = computeHistogram(key).then((bins) => {
    cacheHistogram(key, bins)
    return bins
  })
  histogramRequests.set(key, request)

  const removeRequest = () => {
    if (histogramRequests.get(key) === request) {
      histogramRequests.delete(key)
    }
  }
  void request.then(removeRequest, removeRequest)

  return request
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
      const bins = histogramCache.get(key)
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

    const { height, width } = dimensions
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    const barWidth = width / BIN_COUNT
    const barSpacing = Math.max(1, barWidth * 0.85)
    let channelGradients: Record<Channel, CanvasGradient> | null = null
    let highlightGradient: CanvasGradient | null = null

    const renderHistogram = (data: HistogramBins) => {
      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, width, height)

      if (!channelGradients) {
        channelGradients = {
          blue: ctx.createLinearGradient(0, 0, 0, height),
          green: ctx.createLinearGradient(0, 0, 0, height),
          luminance: ctx.createLinearGradient(0, 0, 0, height),
          red: ctx.createLinearGradient(0, 0, 0, height),
        }

        for (const channel of CHANNELS) {
          const config = CHANNEL_CONFIG[channel]
          const gradient = channelGradients[channel]
          gradient.addColorStop(0, `rgba(${config.rgb}, ${config.alpha})`)
          gradient.addColorStop(
            1,
            `rgba(${config.rgb}, ${config.alpha * 0.12})`,
          )
        }
      }

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
        const gradients = channelGradients
        const drawChannel = (channel: Channel) => {
          const bins = data[channel]
          ctx.fillStyle = gradients[channel]

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
        drawChannel('luminance')

        // Blend Red, Green, Blue with screen composition
        ctx.globalCompositeOperation = 'screen'
        drawChannel('red')
        drawChannel('green')
        drawChannel('blue')
        ctx.globalCompositeOperation = 'source-over'
      }

      // Top ambient light sheen
      if (!highlightGradient) {
        highlightGradient = ctx.createLinearGradient(0, 0, 0, height * 0.25)
        highlightGradient.addColorStop(0, 'rgba(224, 222, 244, 0.03)')
        highlightGradient.addColorStop(1, 'rgba(224, 222, 244, 0)')
      }
      ctx.fillStyle = highlightGradient
      ctx.fillRect(0, 0, width, height * 0.25)
      ctx.restore()
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
