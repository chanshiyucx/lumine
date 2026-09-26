export const NOT_AVAILABLE_LABEL = 'Unknown'

function formatDecimal(value: number, maximumFractionDigits: number) {
  return Number(value.toFixed(maximumFractionDigits)).toString()
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${formatDecimal(bytes / (1024 * 1024), 1)} MB`
  }

  if (bytes >= 1024) {
    return `${formatDecimal(bytes / 1024, 1)} KB`
  }

  return `${bytes} B`
}

export function formatSentenceCase(value?: string) {
  if (!value) {
    return NOT_AVAILABLE_LABEL
  }

  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function formatMegapixels(width: number, height: number) {
  const megapixels = (width * height) / 1_000_000

  if (megapixels >= 10) {
    return `${Math.floor(megapixels)} MP`
  }

  return `${megapixels.toFixed(1)} MP`
}

export function formatFocalLength(value?: number) {
  if (!value) {
    return NOT_AVAILABLE_LABEL
  }

  return `${formatDecimal(value, 1)} mm`
}

export function formatFNumber(value?: number) {
  if (!value) {
    return NOT_AVAILABLE_LABEL
  }

  return `f/${formatDecimal(value, 1)}`
}

export function formatExposureTimeValue(seconds?: number) {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
    return NOT_AVAILABLE_LABEL
  }

  const reciprocal = 1 / seconds
  if (seconds < 1 && Math.abs(reciprocal - Math.round(reciprocal)) < 0.000001) {
    return `1/${Math.round(reciprocal)}`
  }

  return `${Number(seconds.toPrecision(6))}`
}

export function formatExposureTime(seconds?: number) {
  const value = formatExposureTimeValue(seconds)
  return value === NOT_AVAILABLE_LABEL ? value : `${value} s`
}

export function formatIsoValue(value?: number) {
  if (!value) {
    return NOT_AVAILABLE_LABEL
  }

  return `ISO ${value}`
}

export function formatBrightnessValue(value?: number) {
  if (value === undefined) {
    return NOT_AVAILABLE_LABEL
  }

  const normalized = formatDecimal(value, 2)
  const numericValue = Number(normalized)
  const prefix = numericValue > 0 ? '+' : ''

  return `${prefix}${normalized} EV`
}
