'use client'

import { type KeyboardEvent } from 'react'
import { getAvailableCaptureSettings } from '@/components/viewer/lib/viewer-metadata'
import type { GalleryPhoto } from '@/lib/photos'
import {
  formatAlbumChip,
  formatBytes,
  formatMimeLabel,
} from '../viewer/lib/formatters'
import { CaptureSettingChip } from './capture-setting-chip'
import { ThumbnailImage } from './thumbnail-image'

interface MasonryItemProps {
  photo: GalleryPhoto
  index: number
  onOpen: (index: number) => void
  width: number
}

export function MasonryItem({ photo, index, onOpen, width }: MasonryItemProps) {
  const mimeLabel = formatMimeLabel(photo)
  const albumChip = formatAlbumChip(photo.albumKey)
  const captureSettings = getAvailableCaptureSettings(photo)
  const cardHeight = Math.round(width / photo.aspectRatio)

  const handleOpen = () => {
    onOpen(index)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    onOpen(index)
  }

  return (
    <div
      style={{ height: `${cardHeight}px` }}
      className="group bg-surface relative w-full cursor-pointer overflow-hidden"
      data-photo-id={photo.id}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      aria-label={`Open ${photo.title}`}
    >
      <ThumbnailImage
        photo={photo}
        loading="lazy"
        imageClassName="absolute inset-0 h-full w-full origin-center object-cover duration-300 transition-transform group-hover:scale-105"
      />

      <div className="pointer-events-none">
        <div className="from-base/80 via-base/60 pointer-events-none absolute inset-0 bg-linear-to-t to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute inset-x-0 bottom-0 space-y-1 p-3">
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
            <span className="bg-text/10 rounded-full px-2 py-0.5 text-xs opacity-0 backdrop-blur-md duration-300 group-hover:opacity-100">
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
