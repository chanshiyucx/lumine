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
    COLUMN_COUNT_BREAKPOINTS.find(({ minWidth }) => containerWidth >= minWidth)
      ?.columnCount ?? 1

  return {
    columnCount,
    columnWidth:
      (containerWidth - MASONRY_GAP * (columnCount - 1)) / columnCount,
  }
}

export function getDominantMasonryPhoto(
  photos: readonly Photo[],
  positions: readonly MasonryPosition[],
  viewportStart: number,
  viewportEnd: number,
  columnCount: number,
  currentAlbumKey?: string,
): Photo | undefined {
  const albums = new Map<
    string,
    { height: number; photo: Photo; index: number }
  >()

  for (const position of positions) {
    const height = Math.max(
      0,
      Math.min(position.end, viewportEnd) -
        Math.max(position.start, viewportStart),
    )
    const photo = photos[position.index]
    if (height === 0 || !photo) {
      continue
    }

    const album = albums.get(photo.album.key)
    if (album) {
      album.height += height
      // The collection is ordered by capture time, newest first.
      if (position.index < album.index) {
        album.photo = photo
        album.index = position.index
      }
    } else {
      albums.set(photo.album.key, { height, photo, index: position.index })
    }
  }

  let dominant: { height: number; photo: Photo; index: number } | undefined
  for (const album of albums.values()) {
    if (!dominant || album.height > dominant.height) {
      dominant = album
    }
  }

  const current = currentAlbumKey ? albums.get(currentAlbumKey) : undefined
  // Equal-width columns let us compare heights instead of pixel areas.
  const switchMargin =
    Math.max(0, viewportEnd - viewportStart) * columnCount * 0.1
  if (current && dominant && dominant.height - current.height <= switchMargin) {
    return current.photo
  }

  return dominant?.photo
}

export function getPhotoMasonryHeight(
  photo: Pick<Photo, 'aspectRatio'>,
  columnWidth: number,
): number {
  return columnWidth / photo.aspectRatio
}
