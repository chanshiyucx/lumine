'use client'

import { useEffect, useRef, useState } from 'react'
import type { Photo } from '@/lib/photo'
import { cn } from '@/lib/style'
import {
  BIN_COUNT,
  createHistogramBins,
  getHistogram,
  peekHistogram,
  type Channel,
  type HistogramBins,
} from './lib/photo-histogram'

const HISTOGRAM_ANIMATION_DURATION_MS = 750
const HISTOGRAM_ANIMATION_REST_DELTA = 0.001

interface DisplayedHistogram {
  bins: HistogramBins
  key: string
}

const CHANNELS: readonly Channel[] = ['luminance', 'red', 'green', 'blue']

const CHANNEL_CONFIG: Record<Channel, { alpha: number; rgb: string }> = {
  red: { alpha: 0.75, rgb: '235, 111, 146' }, // Rose Pine Love
  green: { alpha: 0.75, rgb: '156, 207, 216' }, // Rose Pine Foam
  blue: { alpha: 0.75, rgb: '196, 167, 231' }, // Rose Pine Iris
  luminance: { alpha: 0.28, rgb: '224, 222, 244' }, // Rose Pine Text
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
            `rgba(${config.rgb}, ${config.alpha * 0.15})`,
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
