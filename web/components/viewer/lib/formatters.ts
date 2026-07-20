import type { Photo } from '@/lib/photos'

export const NOT_AVAILABLE_LABEL = 'Unknown'

export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }

  return `${bytes} B`
}

export function formatMimeLabel(photo: Photo) {
  const extension = photo.original.url.split('.').pop()?.toUpperCase()

  if (extension) {
    return extension
  }

  return photo.original.mime.replace('image/', '').toUpperCase()
}

export function formatAlbumChip(albumKey: string) {
  const [, ...rest] = albumKey.split('-')
  const label = rest.join(' ').trim()

  return label || 'Masonry'
}

export function formatSentenceCase(value?: string) {
  if (!value) {
    return NOT_AVAILABLE_LABEL
  }

  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function formatDateTimeLabel(takenAt?: string) {
  if (!takenAt) {
    return NOT_AVAILABLE_LABEL
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(takenAt)

  if (!match) {
    return takenAt
  }

  const [, year, month, day, hour, minute, second] = match

  return `${year}/${Number(month)}/${Number(day)} ${hour}:${minute}:${second}`
}

export function formatTimeZoneLabel(takenAt?: string) {
  if (!takenAt) {
    return NOT_AVAILABLE_LABEL
  }

  const match = /(Z|[+-]\d{2}:\d{2})$/.exec(takenAt)

  if (!match) {
    return NOT_AVAILABLE_LABEL
  }

  if (match[1] === 'Z') {
    return 'UTC'
  }

  const [hours, minutes] = match[1].slice(1).split(':')
  const sign = match[1][0]
  const normalizedHours = String(Number(hours))

  if (minutes === '00') {
    return `UTC${sign}${normalizedHours}`
  }

  return `UTC${sign}${normalizedHours}:${minutes}`
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

  return `${Number(value.toFixed(1)).toString()} mm`
}

export function formatApertureValue(value?: number) {
  if (!value) {
    return NOT_AVAILABLE_LABEL
  }

  return `f/${Number(value.toFixed(1)).toString()}`
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

  const normalized = Number(value.toFixed(2))
  const prefix = normalized > 0 ? '+' : ''

  return `${prefix}${normalized} EV`
}
