'use client'

import {
  formatAlbumChip,
  formatBytes,
  formatMimeLabel,
} from '@/components/viewer/lib/formatters'
import { getAvailableCaptureSettings } from '@/components/viewer/lib/viewer-metadata'
import type { Photo } from '@/lib/photos'
import { CaptureSettingChip } from './capture-setting-chip'
import { ThumbnailImage } from './thumbnail-image'

interface MasonryItemProps {
  photo: Photo
  index: number
  onOpen: (index: number) => void
  width: number
}

export function MasonryItem({ photo, index, onOpen, width }: MasonryItemProps) {
  const mimeLabel = formatMimeLabel(photo)
  const albumChip = formatAlbumChip(photo.albumKey)
  const captureSettings = getAvailableCaptureSettings(photo)
  const cardHeight = Math.round(width / photo.aspectRatio)

  return (
    <div
      style={{ height: `${cardHeight}px` }}
      className="group bg-surface relative block w-full cursor-pointer overflow-hidden"
      data-photo-id={photo.id}
      onClick={() => onOpen(index)}
      aria-label={`Open ${photo.title}`}
      aria-haspopup="dialog"
    >
      <ThumbnailImage
        photo={photo}
        loading="lazy"
        imageClassName="origin-center duration-300 transition-transform group-hover:scale-105"
      />

      <div className="pointer-events-none">
        <div className="from-base/80 via-base/60 pointer-events-none absolute inset-0 bg-linear-to-t to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute inset-x-0 bottom-0 p-2">
          <h3 className="truncate font-medium opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            {photo.title}
          </h3>
          <div className="flex flex-wrap gap-1.5 text-xs opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span>{mimeLabel}</span>
            <span>•</span>
            <span>
              {photo.original.width} × {photo.original.height}
            </span>
            <span>•</span>
            <span>{formatBytes(photo.original.bytes)}</span>
          </div>
          <div>
            <span className="bg-text/10 mb-2 inline-block rounded-full px-2 py-0.5 text-xs opacity-0 backdrop-blur-md duration-300 group-hover:opacity-100">
              {albumChip}
            </span>
          </div>
          {captureSettings.length > 0 && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {captureSettings.map((setting) => (
                <CaptureSettingChip
                  key={setting.key}
                  setting={setting}
                  className="opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
