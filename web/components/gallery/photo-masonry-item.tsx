import { memo } from 'react'
import { CaptureSettingChip, ThumbnailImage } from '@/components/photo'
import { getAlbumDescriptor } from '@/lib/album'
import type { Photo } from '@/lib/photo'
import { getAvailableCaptureSettings } from '@/lib/photo/capture-settings'
import { formatBytes, formatMimeLabel } from '@/lib/photo/formatters'

const EXPANDED_INFO_MIN_HEIGHT = 140

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
  const mimeLabel = formatMimeLabel(photo)
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
      <ThumbnailImage photo={photo} loading={imageLoading} scaleOnHover />

      <span className="pointer-events-none">
        <span className="from-base/80 via-base/60 absolute inset-0 bg-linear-to-t to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none" />
        <span className="absolute inset-x-0 bottom-0 max-h-full overflow-hidden p-2">
          <span className="block truncate opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none">
            {photo.title}
          </span>
          <span className="flex flex-wrap gap-1.5 text-xs opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none">
            <span>{mimeLabel}</span>
            <span>•</span>
            <span>
              {photo.original.width} × {photo.original.height}
            </span>
            <span>•</span>
            <span>{formatBytes(photo.original.bytes)}</span>
          </span>
          {showExpandedInfo ? (
            <span className="block">
              <span className="bg-text/10 mb-2 inline-block rounded-full px-2 py-0.5 text-xs opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none">
                {getAlbumDescriptor(photo.albumKey).title}
              </span>
              {captureSettings.length > 0 ? (
                <span className="grid grid-cols-2 gap-2 text-xs">
                  {captureSettings.map((setting) => (
                    <CaptureSettingChip
                      key={setting.key}
                      setting={setting}
                      className="opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none"
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
