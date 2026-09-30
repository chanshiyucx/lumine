import { clamp } from '@/lib/math'
import { BIN_COUNT, type Channel, type HistogramBins } from './photo-histogram'

const CHANNELS: readonly Channel[] = ['luminance', 'red', 'green', 'blue']

const CHANNEL_CONFIG: Record<Channel, { alpha: number; rgb: string }> = {
  red: { alpha: 0.75, rgb: '255, 105, 97' },
  green: { alpha: 0.75, rgb: '52, 199, 89' },
  blue: { alpha: 0.75, rgb: '64, 156, 255' },
  luminance: { alpha: 0.28, rgb: '255, 255, 255' },
}

export function calculateSpringProgress(
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

  return clamp(value, 0, 1)
}

export function copyHistogram(
  from: HistogramBins,
  to: HistogramBins,
): HistogramBins {
  for (const channel of CHANNELS) {
    const sourceBins = from[channel]
    const targetBins = to[channel]
    for (let index = 0; index < BIN_COUNT; index++) {
      targetBins[index] = sourceBins[index] ?? 0
    }
  }

  return to
}

export function interpolateHistogram(
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

export function createHistogramRenderer(
  canvas: HTMLCanvasElement,
  dimensions: { height: number; width: number },
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return null
  }

  const { height, width } = dimensions
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
        gradient.addColorStop(1, `rgba(${config.rgb}, ${config.alpha * 0.15})`)
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
          ctx.fillRect(i * barWidth, height - barHeight, barSpacing, barHeight)
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

  return renderHistogram
}
