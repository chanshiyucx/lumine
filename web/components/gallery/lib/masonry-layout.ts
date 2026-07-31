import type { Photo } from '@/lib/photo'

export const MASONRY_GAP = 4
const DESKTOP_BREAKPOINT = 1024
const MOBILE_MIN_COLUMN_WIDTH = 150
const DESKTOP_MIN_COLUMN_WIDTH = 250
const DESKTOP_MAX_COLUMNS = 8

export interface MasonryLayout {
  columnCount: number
  columnWidth: number
}

interface MasonryPosition {
  index: number
  start: number
  end: number
}

export function getMasonryLayout(containerWidth: number): MasonryLayout {
  const minColumnWidth =
    containerWidth < DESKTOP_BREAKPOINT
      ? MOBILE_MIN_COLUMN_WIDTH
      : DESKTOP_MIN_COLUMN_WIDTH
  const maxColumns =
    containerWidth < DESKTOP_BREAKPOINT
      ? Number.POSITIVE_INFINITY
      : DESKTOP_MAX_COLUMNS
  const columnCount = Math.max(
    1,
    Math.min(
      Math.floor(
        (containerWidth + MASONRY_GAP) / (minColumnWidth + MASONRY_GAP),
      ),
      maxColumns,
    ),
  )

  return {
    columnCount,
    columnWidth:
      (containerWidth - MASONRY_GAP * (columnCount - 1)) / columnCount,
  }
}

export function getVisibleMasonryIndexes(
  positions: readonly MasonryPosition[],
  viewportStart: number,
  viewportEnd: number,
): number[] {
  return positions
    .filter(
      (position) =>
        position.end > viewportStart && position.start < viewportEnd,
    )
    .map((position) => position.index)
}

export function getPhotoMasonryHeight(
  photo: Pick<Photo, 'aspectRatio'>,
  columnWidth: number,
): number {
  return columnWidth / photo.aspectRatio
}
