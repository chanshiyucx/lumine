import type { GalleryPhoto } from '@/lib/photos'

export interface PositionedPhoto {
  photo: GalleryPhoto
  index: number
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }

  return `${bytes} B`
}

export function formatMimeLabel(photo: GalleryPhoto) {
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

export function getColumnConfig(width: number) {
  const isMobile = width < 768

  const gap = 4
  const preferredWidth = isMobile ? 150 : 250
  const maxColumns = 8
  const minWidth = isMobile ? 120 : 200
  const maxWidth = isMobile ? 250 : 500

  const estimatedColumnCount = Math.max(
    1,
    Math.floor((width + gap) / (preferredWidth + gap)),
  )
  const nextColumnCount = Math.min(maxColumns, estimatedColumnCount)
  const computedWidth =
    (width - gap * Math.max(0, nextColumnCount - 1)) / nextColumnCount

  if (width < 480) {
    return {
      gap,
      preferredWidth: Math.max(
        minWidth,
        Math.min(computedWidth, preferredWidth),
      ),
      maxColumns: 2,
    }
  }

  return {
    gap,
    preferredWidth: Math.max(minWidth, Math.min(computedWidth, maxWidth)),
    maxColumns,
  }
}
