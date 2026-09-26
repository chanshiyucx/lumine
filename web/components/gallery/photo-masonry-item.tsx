import { memo } from 'react'
import { ThumbnailImage } from '@/components/image'
import { CaptureSettingChip } from '@/components/photo'
import type { Photo } from '@/lib/photo'
import { getAvailableCaptureSettings } from '@/lib/photo/capture-settings'
import { formatBytes } from '@/lib/photo/formatters'
import { cn } from '@/lib/style'

const EXPANDED_INFO_MIN_HEIGHT = 140
const HOVER_REVEAL_CLASS_NAME =
  'opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none'

interface PhotoMasonryItemProps {
  photo: Photo
  index: number
  cardHeight: number
  imageLoading: 'eager' | 'lazy'
  onOpen: (index: number, triggerElement: HTMLElement) => void
}

export const PhotoMasonryItem = memo(function PhotoMasonryItem({
  photo,
  index,
  cardHeight,
  imageLoading,
  onOpen,
}: PhotoMasonryItemProps) {
  const showExpandedInfo = cardHeight > EXPANDED_INFO_MIN_HEIGHT
  const captureSettings = showExpandedInfo
    ? getAvailableCaptureSettings(photo)
    : []

  return (
    <button
      type="button"
      style={{
        aspectRatio: `${photo.thumbnail.width} / ${photo.thumbnail.height}`,
      }}
      className="group bg-surface relative block w-full appearance-none overflow-hidden text-left"
      data-viewer-trigger={photo.id}
      onClick={(event) => onOpen(index, event.currentTarget)}
      aria-label={`Open ${photo.title}`}
      aria-haspopup="dialog"
    >
      <span className="pointer-events-none absolute inset-0 block transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
        <ThumbnailImage photo={photo} loading={imageLoading} />
      </span>

      <span className="pointer-events-none">
        <span
          className={cn(
            'from-base/80 via-base/60 absolute inset-0 bg-linear-to-t to-transparent',
            HOVER_REVEAL_CLASS_NAME,
          )}
        />
        <span className="absolute inset-x-0 bottom-0 max-h-full overflow-hidden p-2">
          <span className={cn('block truncate', HOVER_REVEAL_CLASS_NAME)}>
            {photo.title}
          </span>
          <span
            className={cn(
              'flex flex-wrap gap-1.5 text-xs',
              HOVER_REVEAL_CLASS_NAME,
            )}
          >
            <span>{photo.format}</span>
            <span>•</span>
            <span>
              {photo.original.width} × {photo.original.height}
            </span>
            <span>•</span>
            <span>{formatBytes(photo.original.bytes)}</span>
          </span>
          {showExpandedInfo ? (
            <span className="block">
              <span
                className={cn(
                  'bg-text/10 mb-2 inline-block rounded-full px-2 py-0.5 text-xs backdrop-blur-md',
                  HOVER_REVEAL_CLASS_NAME,
                )}
              >
                {photo.album.title}
              </span>
              {captureSettings.length > 0 ? (
                <span className="grid grid-cols-2 gap-2 text-xs">
                  {captureSettings.map((setting) => (
                    <CaptureSettingChip
                      key={setting.key}
                      setting={setting}
                      className={cn(
                        'backdrop-blur-md',
                        HOVER_REVEAL_CLASS_NAME,
                      )}
                    />
                  ))}
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  )
})
