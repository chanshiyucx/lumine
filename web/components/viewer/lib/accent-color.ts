import type { ThumbHashAsset } from '@/lib/thumbhash'

interface RgbColor {
  r: number
  g: number
  b: number
}

const DARK_BACKGROUND: RgbColor = { r: 28, g: 28, b: 30 }
const WHITE: RgbColor = { r: 255, g: 255, b: 255 }

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function toHex(value: number) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')
}

function rgbToHex({ r, g, b }: RgbColor) {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function mixColor(from: RgbColor, to: RgbColor, amount: number): RgbColor {
  return {
    r: from.r + (to.r - from.r) * amount,
    g: from.g + (to.g - from.g) * amount,
    b: from.b + (to.b - from.b) * amount,
  }
}

function getLuminance({ r, g, b }: RgbColor) {
  const [red, green, blue] = [r, g, b].map((channel) => {
    const value = channel / 255

    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function getContrastRatio(first: RgbColor, second: RgbColor) {
  const firstLuminance = getLuminance(first)
  const secondLuminance = getLuminance(second)
  const lighter = Math.max(firstLuminance, secondLuminance)
  const darker = Math.min(firstLuminance, secondLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

function normalizeContrast(color: RgbColor) {
  const contrastRatio = getContrastRatio(color, DARK_BACKGROUND)

  if (contrastRatio >= 2.2 && contrastRatio <= 4.5) {
    return color
  }

  const target = contrastRatio > 4.5 ? DARK_BACKGROUND : WHITE
  const isWithinRange = (candidate: RgbColor) => {
    const ratio = getContrastRatio(candidate, DARK_BACKGROUND)

    return contrastRatio > 4.5 ? ratio <= 4.5 : ratio >= 2.2
  }

  for (let step = 1; step < 20; step += 1) {
    const candidate = mixColor(color, target, step / 20)

    if (isWithinRange(candidate)) {
      return candidate
    }
  }

  return target
}

export function getPhotoAccentColor(
  averageColor: ThumbHashAsset['averageColor'],
) {
  const alpha = clamp(averageColor.a, 0, 1)
  const color = {
    r: averageColor.r * 255 * alpha + DARK_BACKGROUND.r * (1 - alpha),
    g: averageColor.g * 255 * alpha + DARK_BACKGROUND.g * (1 - alpha),
    b: averageColor.b * 255 * alpha + DARK_BACKGROUND.b * (1 - alpha),
  }

  return rgbToHex(normalizeContrast(color))
}
