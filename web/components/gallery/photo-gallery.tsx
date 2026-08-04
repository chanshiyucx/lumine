'use client'

import { domAnimation, LazyMotion, MotionConfig } from 'motion/react'
import { useEffect, useState } from 'react'
import { publishGalleryHeaderDetail } from '@/components/header/lib/gallery-header-events'
import { useViewerController, Viewer } from '@/components/viewer'
import type { Photo } from '@/lib/photo'
import {
  getGalleryHeaderState,
  type GalleryHeaderState,
} from './lib/gallery-header-state'
import { PhotoMasonry } from './photo-masonry'

interface PhotoGalleryProps {
  photos: Photo[]
  initialPhotoSlug?: string
  fixedHeaderDetail?: GalleryHeaderState
}

const HEADER_SCROLL_THRESHOLD = 500

export function PhotoGallery({
  photos,
  initialPhotoSlug,
  fixedHeaderDetail,
}: PhotoGalleryProps) {
  const viewer = useViewerController({
    photos,
    initialPhotoSlug,
  })
  const isViewerMounted = viewer.state.activeIndex !== null
  const [showHeaderDetail, setShowHeaderDetail] = useState(false)
  const [headerState, setHeaderState] = useState<GalleryHeaderState>({})
  const displayedHeaderState = fixedHeaderDetail ?? headerState

  useEffect(() => {
    if (fixedHeaderDetail) {
      return
    }

    const handleScroll = () => {
      const nextShowHeaderDetail = window.scrollY > HEADER_SCROLL_THRESHOLD

      setShowHeaderDetail((currentShowHeaderDetail) => {
        if (currentShowHeaderDetail === nextShowHeaderDetail) {
          return currentShowHeaderDetail
        }

        return nextShowHeaderDetail
      })
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [fixedHeaderDetail])

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

  useEffect(() => {
    publishGalleryHeaderDetail({
      ...displayedHeaderState,
      showDateRange:
        !!displayedHeaderState.dateRange &&
        (fixedHeaderDetail !== undefined || showHeaderDetail),
    })
  }, [displayedHeaderState, fixedHeaderDetail, showHeaderDetail])

  useEffect(() => {
    return () => {
      publishGalleryHeaderDetail({ showDateRange: false })
    }
  }, [])

  const handleVisiblePhotosChange = (visiblePhotos: Photo[]) => {
    if (fixedHeaderDetail) {
      return
    }

    const nextHeaderState = getGalleryHeaderState(visiblePhotos)

    setHeaderState((currentState) => {
      if (
        currentState.dateRange === nextHeaderState.dateRange &&
        currentState.location === nextHeaderState.location
      ) {
        return currentState
      }

      return nextHeaderState
    })
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <div
          className="flow-root"
          data-gallery-root
          inert={isViewerMounted}
          tabIndex={-1}
        >
          <PhotoMasonry
            photos={photos}
            onPhotoOpen={viewer.open}
            onVisiblePhotosChange={handleVisiblePhotosChange}
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
      </MotionConfig>
    </LazyMotion>
  )
}
