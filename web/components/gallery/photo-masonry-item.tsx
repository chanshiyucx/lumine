import { CaptureSettingChip, ThumbnailImage } from '@/components/photo'
import { getAlbumDescriptor } from '@/lib/albums'
import type { Photo } from '@/lib/photo'
import { formatBytes, formatMimeLabel } from '@/lib/photo/formatters'
import { getAvailableCaptureSettings } from '@/lib/photo/metadata'

interface PhotoMasonryItemProps {
  photo: Photo
  index: number
  imageLoading: 'eager' | 'lazy'
  onOpen: (index: number, triggerElement: HTMLElement) => void
}

export function PhotoMasonryItem({
  photo,
  index,
  imageLoading,
  onOpen,
}: PhotoMasonryItemProps) {
  const mimeLabel = formatMimeLabel(photo)
  const albumTitle = getAlbumDescriptor(photo.albumKey).title
  const captureSettings = getAvailableCaptureSettings(photo)

  return (
    <button
      type="button"
      style={{
        aspectRatio: `${photo.thumbnail.width} / ${photo.thumbnail.height}`,
      }}
      className="photo-masonry-card group bg-surface relative block w-full appearance-none overflow-hidden text-left"
      data-viewer-trigger={photo.id}
      onClick={(event) => onOpen(index, event.currentTarget)}
      aria-label={`Open ${photo.title}`}
      aria-haspopup="dialog"
    >
      <ThumbnailImage photo={photo} loading={imageLoading} scaleOnHover />

      <div className="pointer-events-none">
        <div className="from-base/80 via-base/60 absolute inset-0 bg-linear-to-t to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none" />
        <div className="absolute inset-x-0 bottom-0 max-h-full overflow-hidden p-2">
          <h3 className="truncate opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none">
            {photo.title}
          </h3>
          <div className="flex flex-wrap gap-1.5 text-xs opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none">
            <span>{mimeLabel}</span>
            <span>•</span>
            <span>
              {photo.original.width} × {photo.original.height}
            </span>
            <span>•</span>
            <span>{formatBytes(photo.original.bytes)}</span>
          </div>
          <div className="photo-masonry-expanded-info">
            <span className="bg-text/10 mb-2 inline-block rounded-full px-2 py-0.5 text-xs opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none">
              {albumTitle}
            </span>
          </div>
          {captureSettings.length > 0 && (
            <div className="photo-masonry-expanded-info grid grid-cols-2 gap-2 text-xs">
              {captureSettings.map((setting) => (
                <CaptureSettingChip
                  key={setting.key}
                  setting={setting}
                  className="opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}
