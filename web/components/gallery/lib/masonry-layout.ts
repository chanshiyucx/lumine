import type { Photo } from '@/lib/photo'

export const MASONRY_GAP = 4
const COLUMN_COUNT_BREAKPOINTS = [
  { minWidth: 2048, columnCount: 8 },
  { minWidth: 1800, columnCount: 7 },
  { minWidth: 1440, columnCount: 6 },
  { minWidth: 1200, columnCount: 5 },
  { minWidth: 960, columnCount: 4 },
  { minWidth: 640, columnCount: 3 },
  { minWidth: 320, columnCount: 2 },
] as const

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
  const columnCount =
    COLUMN_COUNT_BREAKPOINTS.find(
      ({ minWidth }) => containerWidth >= minWidth,
    )?.columnCount ?? 1

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
