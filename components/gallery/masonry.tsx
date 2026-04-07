'use client'

import dynamic from 'next/dynamic'
import { Viewer } from '@/components/viewer'
import { useViewerHistory } from '@/components/viewer/hooks/use-photo-viewer-history'
import type { Photo } from '@/lib/photos'
import type { MasonryGridProps } from './masonry-grid'

const MasonryGrid = dynamic<MasonryGridProps>(
  () => import('./masonry-grid').then((mod) => mod.MasonryGrid),
  {
    ssr: false,
  },
)

interface MasonryProps {
  photos: Photo[]
  initialPhotoSlug?: string
}

export function Masonry({ photos, initialPhotoSlug }: MasonryProps) {
  const { activeIndex, setActiveIndex } = useViewerHistory({
    photos,
    initialPhotoSlug,
  })

  return (
    <>
      <MasonryGrid photos={photos} onOpen={setActiveIndex} />

      {activeIndex !== null && (
        <Viewer
          photos={photos}
          activeIndex={activeIndex}
          onClose={() => setActiveIndex(null)}
          onChange={setActiveIndex}
        />
      )}
    </>
  )
}
