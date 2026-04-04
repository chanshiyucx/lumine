'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { GalleryPhoto } from '@/lib/photos'
import { cn } from '@/lib/utils/style'

interface PositionedPhoto {
  photo: GalleryPhoto
  index: number
}

interface PhotoGalleryProps {
  albumLabel: string
  updatedAt: string
  photos: GalleryPhoto[]
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }

  return `${bytes} B`
}

function formatMimeLabel(photo: GalleryPhoto) {
  const extension = photo.original.url.split('.').pop()?.toUpperCase()

  if (extension) {
    return extension
  }

  return photo.original.mime.replace('image/', '').toUpperCase()
}

function formatAlbumChip(albumKey: string) {
  const [, ...rest] = albumKey.split('-')
  const label = rest.join(' ').trim()

  return label || 'Gallery'
}

function formatUpdatedAt(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.valueOf())) {
    return null
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
  }).format(date)
}

function getColumnConfig(width: number) {
  const isMobile = width < 768

  const gap = 4
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

function PhotoCard({ photo, index }: { photo: GalleryPhoto; index: number }) {
  const imageRef = useRef<HTMLImageElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const mimeLabel = formatMimeLabel(photo)
  const albumChip = formatAlbumChip(photo.albumKey)
  const metaLabel = `${mimeLabel} • ${photo.original.width} × ${photo.original.height} • ${formatBytes(photo.original.bytes)}`

  const handleOpen = () => {
    // onOpen(index)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    // onOpen(index)
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
      className="w-full opacity-0 motion-safe:[animation:gallery-reveal_620ms_cubic-bezier(0.16,1,0.3,1)_forwards] motion-reduce:opacity-100"
      style={{
        animationDelay: `${Math.min(index * 28, 280)}ms`,
      }}
    >
      <div
        role="button"
        tabIndex={0}
        className="group relative w-full cursor-pointer overflow-hidden bg-black/20 outline-none focus-visible:ring-2 focus-visible:ring-white/70"
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
          className="absolute inset-0 h-full w-full object-cover"
        />

        {!hasError ? (
          <div className="absolute inset-0 overflow-hidden">
            <img
              ref={imageRef}
              src={photo.thumbnail.url}
              alt={photo.alt}
              loading="lazy"
              className={cn(
                'absolute inset-0 h-full w-full origin-center transform-gpu object-cover transition-[opacity,transform] duration-300 ease-out will-change-transform [backface-visibility:hidden]',
                isLoaded ? 'opacity-100' : 'opacity-0',
                'group-hover:scale-105',
              )}
              onLoad={() => setIsLoaded(true)}
              onError={() => setHasError(true)}
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-white/6 text-sm text-white/56">
            Image unavailable
          </div>
        )}

        <div className="pointer-events-none">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="absolute inset-x-0 bottom-0 p-3 text-left text-white">
            <div className="space-y-1.5">
              <h3 className="truncate text-sm font-medium opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {photo.title}
              </h3>
              <div className="flex flex-wrap gap-1.5 text-[11px] text-white/80 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <span>{metaLabel}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] text-white/92 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
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

export function PhotoGallery({ photos }: PhotoGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const node = containerRef.current

    if (!node) {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const nextWidth = Math.floor(entries[0]?.contentRect.width ?? 0)

      setContainerWidth((currentWidth) => {
        if (currentWidth === nextWidth) {
          return currentWidth
        }

        return nextWidth
      })
    })

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [])

  const { columns, gap } = useMemo(() => {
    if (photos.length === 0) {
      return { columns: [] as PositionedPhoto[][], gap: 12 }
    }

    if (containerWidth === 0) {
      return {
        columns: [photos.map((photo, index) => ({ photo, index }))],
        gap: 12,
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
    const nextColumns = Array.from(
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

      nextColumns[targetColumn].push({ photo, index })
      columnHeights[targetColumn] += itemWidth / photo.aspectRatio + config.gap
    }

    return { columns: nextColumns, gap: config.gap }
  }, [containerWidth, photos])

  return (
    <>
      <div className="relative min-h-screen w-full max-w-full overflow-x-clip">
        <main className="w-full max-w-full overflow-x-clip">
          <div
            ref={containerRef}
            role="grid"
            aria-label="Photo gallery"
            className="flex w-full max-w-full items-start"
            style={{ gap }}
          >
            {columns.map((column, columnIndex) => (
              <div
                key={columnIndex}
                className="flex min-w-0 flex-1 flex-col"
                style={{ gap }}
              >
                {column.map(({ photo, index }) => (
                  <PhotoCard key={photo.id} photo={photo} index={index} />
                ))}
              </div>
            ))}
          </div>
        </main>
      </div>
    </>
  )
}
