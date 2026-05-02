import 'server-only'
import { decodeBlurhash } from './blurhash'
import type { PhotoAccentPalette, PhotoAsset } from './photos'

interface RgbColor {
  r: number
  g: number
  b: number
}

interface HslColor {
  h: number
  s: number
  l: number
}

interface ColorAccumulator {
  r: number
  g: number
  b: number
  weight: number
}

const SOURCE_SIZE = 32
const DARK_BACKGROUND: RgbColor = { r: 39, g: 36, b: 54 }
const WHITE: RgbColor = { r: 255, g: 255, b: 255 }
const FALLBACK_PALETTE: PhotoAccentPalette = {
  accent: '#8c7bd9',
  surface: '#302d42',
  rightEdge: '#554f77',
  bottomEdge: '#554f77',
  glow: '#a99cf0',
}

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

function rgbToHsl({ r, g, b }: RgbColor): HslColor {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  const lightness = (max + min) / 2

  if (delta === 0) {
    return { h: 0, s: 0, l: lightness }
  }

  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let hue = 0

  if (max === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0)
  } else if (max === green) {
    hue = (blue - red) / delta + 2
  } else {
    hue = (red - green) / delta + 4
  }

  return { h: hue / 6, s: saturation, l: lightness }
}

function hueToRgb(p: number, q: number, t: number) {
  let hue = t

  if (hue < 0) {
    hue += 1
  }

  if (hue > 1) {
    hue -= 1
  }

  if (hue < 1 / 6) {
    return p + (q - p) * 6 * hue
  }

  if (hue < 1 / 2) {
    return q
  }

  if (hue < 2 / 3) {
    return p + (q - p) * (2 / 3 - hue) * 6
  }

  return p
}

function hslToRgb({ h, s, l }: HslColor): RgbColor {
  if (s === 0) {
    const value = l * 255
    return { r: value, g: value, b: value }
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q

  return {
    r: hueToRgb(p, q, h + 1 / 3) * 255,
    g: hueToRgb(p, q, h) * 255,
    b: hueToRgb(p, q, h - 1 / 3) * 255,
  }
}

function shapeColor(
  color: RgbColor,
  {
    saturationBoost,
    minSaturation,
    maxSaturation,
    minLightness,
    maxLightness,
  }: {
    saturationBoost: number
    minSaturation: number
    maxSaturation: number
    minLightness: number
    maxLightness: number
  },
) {
  const hsl = rgbToHsl(color)

  return hslToRgb({
    h: hsl.h,
    s: clamp(
      Math.max(hsl.s * saturationBoost, minSaturation),
      minSaturation,
      maxSaturation,
    ),
    l: clamp(hsl.l, minLightness, maxLightness),
  })
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

function normalizeAccentColor(color: RgbColor) {
  const contrastRatio = getContrastRatio(color, DARK_BACKGROUND)

  if (contrastRatio >= 2.2 && contrastRatio <= 4.5) {
    return color
  }

  if (contrastRatio > 4.5) {
    for (let amount = 0.05; amount <= 1; amount += 0.05) {
      const candidate = mixColor(color, DARK_BACKGROUND, amount)

      if (getContrastRatio(candidate, DARK_BACKGROUND) <= 4.5) {
        return candidate
      }
    }

    return mixColor(color, DARK_BACKGROUND, 0.8)
  }

  for (let amount = 0.05; amount <= 1; amount += 0.05) {
    const candidate = mixColor(color, WHITE, amount)

    if (getContrastRatio(candidate, DARK_BACKGROUND) >= 2.2) {
      return candidate
    }
  }

  return mixColor(color, WHITE, 0.8)
}

function createAccumulator(): ColorAccumulator {
  return { r: 0, g: 0, b: 0, weight: 0 }
}

function addColor(
  accumulator: ColorAccumulator,
  { r, g, b }: RgbColor,
  weight: number,
) {
  accumulator.r += r * weight
  accumulator.g += g * weight
  accumulator.b += b * weight
  accumulator.weight += weight
}

function getAverageColor(accumulator: ColorAccumulator) {
  if (accumulator.weight === 0) {
    return null
  }

  return {
    r: accumulator.r / accumulator.weight,
    g: accumulator.g / accumulator.weight,
    b: accumulator.b / accumulator.weight,
  }
}

function createPalette({
  full,
  rightEdge,
  bottomEdge,
  vivid,
}: {
  full: RgbColor
  rightEdge: RgbColor
  bottomEdge: RgbColor
  vivid: RgbColor
}): PhotoAccentPalette {
  const accent = normalizeAccentColor(
    shapeColor(vivid, {
      saturationBoost: 1.4,
      minSaturation: 0.2,
      maxSaturation: 0.58,
      minLightness: 0.34,
      maxLightness: 0.58,
    }),
  )
  const surface = shapeColor(full, {
    saturationBoost: 0.72,
    minSaturation: 0.08,
    maxSaturation: 0.28,
    minLightness: 0.27,
    maxLightness: 0.42,
  })
  const glow = normalizeAccentColor(
    shapeColor(vivid, {
      saturationBoost: 1.55,
      minSaturation: 0.24,
      maxSaturation: 0.64,
      minLightness: 0.38,
      maxLightness: 0.6,
    }),
  )

  return {
    accent: rgbToHex(accent),
    surface: rgbToHex(surface),
    rightEdge: rgbToHex(
      normalizeAccentColor(
        shapeColor(rightEdge, {
          saturationBoost: 1.08,
          minSaturation: 0.14,
          maxSaturation: 0.46,
          minLightness: 0.3,
          maxLightness: 0.54,
        }),
      ),
    ),
    bottomEdge: rgbToHex(
      normalizeAccentColor(
        shapeColor(bottomEdge, {
          saturationBoost: 1.08,
          minSaturation: 0.14,
          maxSaturation: 0.46,
          minLightness: 0.3,
          maxLightness: 0.54,
        }),
      ),
    ),
    glow: rgbToHex(glow),
  }
}

export function createPhotoAccentPalette(
  blurhash: string,
  thumbnail: PhotoAsset,
): PhotoAccentPalette {
  const width = SOURCE_SIZE
  const height = Math.max(
    1,
    Math.round((thumbnail.height / thumbnail.width) * width),
  )
  let data: Uint8ClampedArray

  try {
    data = decodeBlurhash(blurhash, width, height)
  } catch {
    return FALLBACK_PALETTE
  }

  const rightEdgeStart = Math.floor(width * 0.62)
  const bottomEdgeStart = Math.floor(height * 0.62)
  const full = createAccumulator()
  const rightEdge = createAccumulator()
  const bottomEdge = createAccumulator()
  const vivid = createAccumulator()

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const color = {
        r: data[index],
        g: data[index + 1],
        b: data[index + 2],
      }
      const hsl = rgbToHsl(color)
      const midtoneWeight = 1 - clamp(Math.abs(hsl.l - 0.5) * 1.8, 0, 0.85)
      const vividWeight = hsl.s * hsl.s * midtoneWeight

      addColor(full, color, 1)

      if (x >= rightEdgeStart) {
        addColor(rightEdge, color, 1)
      }

      if (y >= bottomEdgeStart) {
        addColor(bottomEdge, color, 1)
      }

      if (hsl.s > 0.06 && hsl.l > 0.12 && hsl.l < 0.88) {
        addColor(vivid, color, Math.max(0.02, vividWeight))
      }
    }
  }

  const fullColor = getAverageColor(full)

  if (!fullColor) {
    return FALLBACK_PALETTE
  }

  return createPalette({
    full: fullColor,
    rightEdge: getAverageColor(rightEdge) ?? fullColor,
    bottomEdge: getAverageColor(bottomEdge) ?? fullColor,
    vivid: getAverageColor(vivid) ?? fullColor,
  })
}
