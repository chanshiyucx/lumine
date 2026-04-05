'use client'

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { GalleryPhoto } from '@/lib/photos'
import { cn } from '@/lib/utils/style'
import {
  formatAlbumChip,
  formatBytes,
  formatMimeLabel,
} from './photo-masonry.utils'

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
        <img
          src={photo.blurDataUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 object-cover"
        />

        {!hasError ? (
          <img
            ref={imageRef}
            src={photo.thumbnail.url}
            alt={photo.alt}
            loading="lazy"
            className={cn(
              'absolute inset-0 origin-center object-cover transition-all duration-300',
              isLoaded ? 'opacity-100' : 'opacity-0',
              'group-hover:scale-105',
            )}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm">
            Image unavailable
          </div>
        )}

        <div className="pointer-events-none">
          <div className="from-base/80 via-base/20 pointer-events-none absolute inset-0 bg-linear-to-t to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="absolute inset-x-0 bottom-0 p-3 text-left">
            <div className="space-y-1.5">
              <h3 className="truncate text-sm font-medium opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {photo.title}
              </h3>
              <div className="flex flex-wrap gap-1.5 text-xs opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <span>{metaLabel}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
                  {albumChip}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
