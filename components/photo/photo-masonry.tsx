'use client'

import { useCallback, useMemo, useRef } from 'react'
import type { GalleryPhoto } from '@/lib/photos'
import { useElementWidth } from './hooks/use-element-width'
import { usePhotoViewerHistory } from './hooks/use-photo-viewer-history'
import { buildMasonryLayout } from './lib/masonry-layout'
import { PhotoCard } from './photo-card'
import { PhotoViewer } from './photo-viewer'

interface PhotoMasonryProps {
  photos: GalleryPhoto[]
  initialPhotoSlug?: string
}

export function PhotoMasonry({ photos, initialPhotoSlug }: PhotoMasonryProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const containerWidth = useElementWidth(containerRef)
  const { activeIndex, setActiveIndex } = usePhotoViewerHistory({
    photos,
    initialPhotoSlug,
  })

  const { columns, gap } = useMemo(() => {
    return buildMasonryLayout(photos, containerWidth)
  }, [containerWidth, photos])

  const handleOpen = useCallback(
    (index: number) => {
      setActiveIndex(index)
    },
    [setActiveIndex],
  )

  const handleClose = useCallback(() => {
    setActiveIndex(null)
  }, [setActiveIndex])

  const handleChange = useCallback(
    (index: number) => {
      setActiveIndex(index)
    },
    [setActiveIndex],
  )

  return (
    <>
      <div className="relative min-h-screen w-full max-w-full overflow-x-clip">
        <main className="w-full max-w-full overflow-x-clip">
          <div
            ref={containerRef}
            role="grid"
            aria-label="Photo Masonry"
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
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    index={index}
                    onOpen={handleOpen}
                  />
                ))}
              </div>
            ))}
          </div>
        </main>
      </div>

      {activeIndex !== null ? (
        <PhotoViewer
          photos={photos}
          activeIndex={activeIndex}
          onClose={handleClose}
          onChange={handleChange}
        />
      ) : null}
    </>
  )
}
