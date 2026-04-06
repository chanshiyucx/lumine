'use client'

import dynamic from 'next/dynamic'
import { useCallback } from 'react'
import type { GalleryPhoto } from '@/lib/photos'
import { usePhotoViewerHistory } from './hooks/use-photo-viewer-history'
import type { PhotoMasonryGridProps } from './photo-masonry-grid'
import { PhotoViewer } from './photo-viewer'

const PhotoMasonryGrid = dynamic<PhotoMasonryGridProps>(
  () => import('./photo-masonry-grid').then((mod) => mod.PhotoMasonryGrid),
  {
    ssr: false,
  },
)

interface PhotoMasonryProps {
  photos: GalleryPhoto[]
  initialPhotoSlug?: string
}

export function PhotoMasonry({ photos, initialPhotoSlug }: PhotoMasonryProps) {
  const { activeIndex, setActiveIndex } = usePhotoViewerHistory({
    photos,
    initialPhotoSlug,
  })

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
    <main className="min-h-screen w-screen max-w-screen">
      <PhotoMasonryGrid photos={photos} onOpen={handleOpen} />

      {activeIndex !== null && (
        <PhotoViewer
          photos={photos}
          activeIndex={activeIndex}
          onClose={handleClose}
          onChange={handleChange}
        />
      )}
    </main>
  )
}
