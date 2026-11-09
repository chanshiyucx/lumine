import { cn } from '@/lib/style'

// Matches the gallery's column-count breakpoints (see getMasonryLayout).
const COLUMN_CLASS_NAMES = [
  'flex',
  'hidden @min-[320px]:flex',
  'hidden @min-[640px]:flex',
  'hidden @min-[960px]:flex',
  'hidden @min-[1200px]:flex',
  'hidden @min-[1440px]:flex',
  'hidden @min-[1800px]:flex',
  'hidden @min-[2048px]:flex',
]
const TILES_PER_COLUMN = 14
const TILE_TONES = [
  'bg-surface',
  'bg-love/10',
  'bg-gold/10',
  'bg-rose/10',
  'bg-pine/10',
  'bg-foam/10',
  'bg-iris/10',
]

const COLUMNS = COLUMN_CLASS_NAMES.map((className, column) => ({
  className,
  tiles: Array.from({ length: TILES_PER_COLUMN }, (_, index) => ({
    isPortrait: (column + index) % 2 === 1,
    tone: TILE_TONES[(column * 3 + index) % TILE_TONES.length],
  })),
}))

export function LockedAlbumBackdrop() {
  return (
    <div className="@container absolute inset-0" aria-hidden="true">
      <div className="flex gap-1">
        {COLUMNS.map((column, columnIndex) => (
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
