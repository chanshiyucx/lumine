'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef } from 'react'
import { publishPhotoCount } from '@/components/header/lib/photo-count-store'
import { useScrollElement } from '@/components/scroll-area/scroll-area'
import { useViewerController } from '@/components/viewer/hooks/use-viewer-controller'
import type { Photo } from '@/lib/photo'
import type { PhotoScope } from '@/lib/route-paths'
import {
  useGalleryHeader,
  type GalleryHeaderState,
} from './hooks/use-gallery-header'
import { PhotoMasonry } from './photo-masonry'

const Viewer = dynamic(() =>
  import('@/components/viewer/viewer').then((module) => module.Viewer),
)

const preloadViewer = () => import('@/components/viewer/viewer').catch(() => {})
const VIEWER_PRELOAD_FALLBACK_DELAY = 1000

interface PhotoGalleryProps {
  photos: Photo[]
  initialPhotoSlug?: string
  fixedHeaderDetail?: Required<GalleryHeaderState>
  scope?: PhotoScope
}

export function PhotoGallery({
  photos,
  initialPhotoSlug,
  fixedHeaderDetail,
  scope = 'public',
}: PhotoGalleryProps) {
  const galleryRef = useRef<HTMLElement>(null)
  const scrollElement = useScrollElement()
  const viewer = useViewerController({
    photos,
    initialPhotoSlug,
    galleryRef,
    scope,
  })
  const viewerState = viewer.state
  const isViewerMounted = viewerState.phase !== 'closed'
  const hasFixedHeader = fixedHeaderDetail !== undefined
  const pageHeading =
    fixedHeaderDetail?.location ?? (scope === 'private' ? 'Private' : 'Photos')
  const handleVisiblePhotoChange = useGalleryHeader(
    scrollElement,
    fixedHeaderDetail,
  )

  // The header's server-rendered total covers public photos only.
  useEffect(() => {
    if (scope !== 'private') {
      return
    }

    publishPhotoCount(photos.length)
    return () => publishPhotoCount(null)
  }, [scope, photos.length])

  useEffect(() => {
    if (initialPhotoSlug) {
      return
    }

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(preloadViewer)
      return () => window.cancelIdleCallback(idleId)
    }

    const timeoutId = setTimeout(preloadViewer, VIEWER_PRELOAD_FALLBACK_DELAY)
    return () => clearTimeout(timeoutId)
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
      <main
        ref={galleryRef}
        className="pt-12"
        inert={isViewerMounted}
        tabIndex={-1}
      >
        <h1 className="sr-only">{pageHeading}</h1>
        <PhotoMasonry
          photos={photos}
          onPhotoOpen={viewer.open}
          onVisiblePhotoChange={
            hasFixedHeader ? undefined : handleVisiblePhotoChange
          }
        />
      </main>

      {isViewerMounted && (
        <Viewer
          photos={photos}
          scope={scope}
          state={viewerState}
          getRestoreFocusElement={viewer.getRestoreFocusElement}
          onActiveIndexChange={viewer.select}
          onClose={viewer.close}
          onEntryComplete={viewer.completeEntry}
          onExitComplete={viewer.completeExit}
          onPresenceChange={viewer.setPresence}
          onZoomStateChange={viewer.setZoomed}
        />
      )}
    </>
  )
}
