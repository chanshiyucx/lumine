'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { GalleryPhoto } from '@/lib/photos'
import { cn } from '@/lib/style'
import { formatAlbumChip, formatBytes, formatMimeLabel } from './lib/formatters'
import { getAvailableCaptureSettings } from './lib/viewer-metadata'
import { PhotoCaptureSettingChip } from './photo-capture-setting-chip'
import { PhotoThumbnailImage } from './photo-thumbnail-image'

interface PhotoCardProps {
  photo: GalleryPhoto
  index: number
  onOpen: (index: number) => void
}

export function PhotoCard({ photo, index, onOpen }: PhotoCardProps) {
  const imageRef = useRef<HTMLImageElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const mimeLabel = formatMimeLabel(photo)
  const albumChip = formatAlbumChip(photo.albumKey)
  const captureSettings = getAvailableCaptureSettings(photo)
  const metaLabel = `${mimeLabel} • ${photo.original.width} × ${photo.original.height} • ${formatBytes(photo.original.bytes)}`

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

  useEffect(() => {
    const image = imageRef.current

    if (!image || isLoaded || hasError || !image.complete) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      if (image.naturalWidth > 0) {
        setIsLoaded(true)
        return
      }

      setHasError(true)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [hasError, isLoaded, photo.id])

  return (
    <div
      role="gridcell"
      className="motion-safe:animate-gallery-reveal w-full opacity-0 motion-reduce:opacity-100"
      style={{
        animationDelay: `${Math.min(index * 30, 300)}ms`,
      }}
    >
      <div
        role="button"
        tabIndex={0}
        className="group bg-base/40 relative w-full cursor-pointer overflow-hidden outline-none"
        data-photo-id={photo.title}
        style={{
          aspectRatio: `${photo.thumbnail.width} / ${photo.thumbnail.height}`,
        }}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        aria-label={`Open ${photo.title}`}
      >
        {!hasError ? (
          <PhotoThumbnailImage
            photo={photo}
            imageRef={imageRef}
            loading="lazy"
            imageClassName={cn(
              'absolute inset-0 h-full w-full origin-center object-cover transition-all duration-300',
              isLoaded ? 'opacity-100' : 'opacity-0',
              'group-hover:scale-105',
            )}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
          />
        ) : (
          <div className="text-muted absolute inset-0 flex items-center justify-center text-sm">
            Image unavailable
          </div>
        )}

        <div className="pointer-events-none">
          <div className="from-base/96 via-base/66 pointer-events-none absolute inset-0 bg-linear-to-t to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="absolute inset-x-0 bottom-0 p-3 text-left">
            <div className="space-y-2">
              <h3 className="text-text/96 truncate text-sm font-medium opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {photo.title}
              </h3>
              <div className="text-text/82 flex flex-wrap gap-1.5 text-xs opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <span>{metaLabel}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="border-subtle/20 bg-overlay/78 text-text/88 rounded-full border px-2.5 py-1 text-xs opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
                  {albumChip}
                </span>
              </div>
              {captureSettings.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 opacity-0 transition-all duration-300 group-hover:opacity-100">
                  {captureSettings.map((setting) => (
                    <PhotoCaptureSettingChip
                      key={setting.key}
                      setting={setting}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
