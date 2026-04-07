'use client'

import dynamic from 'next/dynamic'
import { useCallback } from 'react'
import { Viewer } from '@/components/viewer'
import { useViewerHistory } from '@/components/viewer/hooks/use-photo-viewer-history'
import type { GalleryPhoto } from '@/lib/photos'
import type { MasonryGridProps } from './masonry-grid'

const MasonryGrid = dynamic<MasonryGridProps>(
  () => import('./masonry-grid').then((mod) => mod.MasonryGrid),
  {
    ssr: false,
  },
)

interface MasonryProps {
  photos: GalleryPhoto[]
  initialPhotoSlug?: string
}

export function Masonry({ photos, initialPhotoSlug }: MasonryProps) {
  const { activeIndex, setActiveIndex } = useViewerHistory({
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
    <>
      <MasonryGrid photos={photos} onOpen={handleOpen} />

      {activeIndex !== null && (
        <Viewer
          photos={photos}
          activeIndex={activeIndex}
          onClose={handleClose}
          onChange={handleChange}
        />
      )}
    </>
  )
}
