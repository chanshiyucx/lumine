import { useMobile } from '@/hooks/use-mobile'
import type { Photo } from '@/lib/photos'

export const MASONRY_GAP = 4
const MOBILE_COLUMN_WIDTH = 150
const DESKTOP_COLUMN_WIDTH = 250
const DESKTOP_MAX_COLUMNS = 8
const FALLBACK_ESTIMATED_ASPECT_RATIO = 1.5

export interface MasonryConfig {
  columnGutter: number
  rowGutter: number
  columnWidth: number
  maxColumns?: number
}

const MOBILE_MASONRY_CONFIG: MasonryConfig = {
  columnGutter: MASONRY_GAP,
  rowGutter: MASONRY_GAP,
  columnWidth: MOBILE_COLUMN_WIDTH,
}

const DESKTOP_MASONRY_CONFIG: MasonryConfig = {
  columnGutter: MASONRY_GAP,
  rowGutter: MASONRY_GAP,
  columnWidth: DESKTOP_COLUMN_WIDTH,
  maxColumns: DESKTOP_MAX_COLUMNS,
}

export function useMasonryConfig(): MasonryConfig {
  const isMobile = useMobile()

  return isMobile ? MOBILE_MASONRY_CONFIG : DESKTOP_MASONRY_CONFIG
}

export function getMasonryItemHeightEstimate(
  photos: Photo[],
  columnWidth: number,
) {
  if (photos.length === 0 || columnWidth <= 0) {
    return Math.round(columnWidth / FALLBACK_ESTIMATED_ASPECT_RATIO) || 240
  }

  const sortedAspectRatios = photos
    .slice(0, 48)
    .map((photo) => photo.aspectRatio)
    .sort((left, right) => left - right)
  const middleIndex = Math.floor(sortedAspectRatios.length / 2)
  const medianAspectRatio =
    sortedAspectRatios[middleIndex] ?? FALLBACK_ESTIMATED_ASPECT_RATIO

  return Math.max(180, Math.round(columnWidth / medianAspectRatio))
}

export function getPhotoIndexFromPathname(
  pathname: string,
  slugToIndex: Map<string, number>,
) {
  const match = /^\/photos\/([^/]+)$/.exec(pathname)

  if (!match) {
    return null
  }

  return slugToIndex.get(decodeURIComponent(match[1])) ?? null
}
