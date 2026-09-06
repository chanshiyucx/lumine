'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { useScrollElement } from '@/components/scroll-area'
import { useViewerController } from '@/components/viewer/hooks/use-viewer-controller'
import type { Photo } from '@/lib/photo'
import { useGalleryHeader } from './hooks/use-gallery-header'
import type { GalleryHeaderState } from './lib/gallery-header-state'
import { PhotoMasonry } from './photo-masonry'

const Viewer = dynamic(() =>
  import('@/components/viewer/viewer').then((module) => module.Viewer),
)

const preloadViewer = () =>
  import('@/components/viewer/viewer').catch(() => {
    // Optional preload; opening the viewer still uses next/dynamic.
  })

interface PhotoGalleryProps {
  photos: Photo[]
  initialPhotoSlug?: string
  fixedHeaderDetail?: Required<GalleryHeaderState>
}

export function PhotoGallery({
  photos,
  initialPhotoSlug,
  fixedHeaderDetail,
}: PhotoGalleryProps) {
  const scrollElement = useScrollElement()
  const viewer = useViewerController({
    photos,
    initialPhotoSlug,
  })
  const isViewerMounted = viewer.state.activeIndex !== null
  const hasFixedHeader = fixedHeaderDetail !== undefined
  const handleVisiblePhotoChange = useGalleryHeader(
    scrollElement,
    fixedHeaderDetail,
  )

  useEffect(() => {
    if (initialPhotoSlug || !('requestIdleCallback' in window)) {
      return
    }

    const idleId = window.requestIdleCallback(preloadViewer)
    return () => window.cancelIdleCallback(idleId)
  }, [initialPhotoSlug])

  useEffect(() => {
    const header = document.querySelector<HTMLElement>('[data-site-header]')
    if (!header) {
      return
    }

    header.inert = isViewerMounted

    return () => {
      header.inert = false
    }
  }, [isViewerMounted])

  return (
    <>
      <div
        className="pt-12"
        data-gallery-root
        inert={isViewerMounted}
        tabIndex={-1}
      >
        <PhotoMasonry
          photos={photos}
          onPhotoOpen={viewer.open}
          onVisiblePhotoChange={
            hasFixedHeader ? undefined : handleVisiblePhotoChange
          }
        />
      </div>

      {isViewerMounted && (
        <Viewer
          photos={photos}
          state={viewer.state}
          getRestoreFocusElement={viewer.getRestoreFocusElement}
          onActiveIndexChange={viewer.select}
          onClose={viewer.close}
          onEntryComplete={viewer.completeEntry}
          onExitComplete={viewer.completeExit}
          onZoomStateChange={viewer.setZoomed}
        />
      )}
    </>
  )
}
