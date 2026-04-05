import type { GalleryPhoto } from '@/lib/photos'

const MASONRY_GAP = 4

export interface PositionedPhoto {
  photo: GalleryPhoto
  index: number
}

interface ColumnConfig {
  gap: number
  preferredWidth: number
  maxColumns: number
}

interface MasonryLayout {
  columns: PositionedPhoto[][]
  gap: number
}

export function getColumnConfig(width: number): ColumnConfig {
  const isMobile = width < 768

  const gap = MASONRY_GAP
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

export function buildMasonryLayout(
  photos: GalleryPhoto[],
  containerWidth: number,
): MasonryLayout {
  if (photos.length === 0) {
    return { columns: [], gap: MASONRY_GAP }
  }

  if (containerWidth === 0) {
    return {
      columns: [photos.map((photo, index) => ({ photo, index }))],
      gap: MASONRY_GAP,
    }
  }

  const config = getColumnConfig(containerWidth)
  const columnCount = Math.max(
    1,
    Math.min(
      config.maxColumns,
      Math.floor(
        (containerWidth + config.gap) / (config.preferredWidth + config.gap),
      ),
    ),
  )
  const itemWidth =
    (containerWidth - config.gap * Math.max(0, columnCount - 1)) / columnCount
  const columnHeights = Array.from({ length: columnCount }, () => 0)
  const columns = Array.from(
    { length: columnCount },
    () => [] as PositionedPhoto[],
  )

  for (const [index, photo] of photos.entries()) {
    let targetColumn = 0

    for (let columnIndex = 1; columnIndex < columnCount; columnIndex += 1) {
      if (columnHeights[columnIndex] < columnHeights[targetColumn]) {
        targetColumn = columnIndex
      }
    }

    columns[targetColumn].push({ photo, index })
    columnHeights[targetColumn] += itemWidth / photo.aspectRatio + config.gap
  }

  return { columns, gap: config.gap }
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
