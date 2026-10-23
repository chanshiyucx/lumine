import { cn } from '@/lib/style'

// Matches the gallery's column-count breakpoints (see getMasonryLayout).
const columnClassNames = [
  'flex',
  'hidden @min-[320px]:flex',
  'hidden @min-[640px]:flex',
  'hidden @min-[960px]:flex',
  'hidden @min-[1200px]:flex',
  'hidden @min-[1440px]:flex',
  'hidden @min-[1800px]:flex',
  'hidden @min-[2048px]:flex',
]
const tilesPerColumn = 14
const tileTones = [
  'bg-surface',
  'bg-iris/12',
  'bg-overlay',
  'bg-foam/10',
  'bg-surface',
  'bg-rose/10',
  'bg-pine/15',
]

const columns = columnClassNames.map((className, column) => ({
  className,
  tiles: Array.from({ length: tilesPerColumn }, (_, index) => ({
    isPortrait: (column + index) % 2 === 1,
    tone: tileTones[(column * 3 + index) % tileTones.length],
  })),
}))

export function LockedAlbumBackdrop() {
  return (
    <div className="@container absolute inset-0" aria-hidden="true">
      <div className="flex gap-1">
        {columns.map((column, columnIndex) => (
          <div
            key={columnIndex}
            className={cn('min-w-0 flex-1 flex-col gap-1', column.className)}
          >
            {column.tiles.map((tile, tileIndex) => (
              <div
                key={tileIndex}
                className={cn(
                  tile.isPortrait ? 'aspect-2/3' : 'aspect-3/2',
                  tile.tone,
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
