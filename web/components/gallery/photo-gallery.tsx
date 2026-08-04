'use client'

import { domAnimation, LazyMotion, MotionConfig } from 'motion/react'
import { useEffect, useState } from 'react'
import { publishGalleryHeaderDetail } from '@/components/header/lib/gallery-header-store'
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
  fixedHeaderLocation?: string
}

const HEADER_SCROLL_THRESHOLD = 500

export function PhotoGallery({
  photos,
  initialPhotoSlug,
  fixedHeaderLocation,
}: PhotoGalleryProps) {
  const viewer = useViewerController({
    photos,
    initialPhotoSlug,
  })
  const isViewerMounted = viewer.state.activeIndex !== null
  const hasFixedHeader = fixedHeaderLocation !== undefined
  const [showHeaderDetail, setShowHeaderDetail] = useState(false)
  const [headerState, setHeaderState] = useState<GalleryHeaderState>({})
  const fixedHeaderState = hasFixedHeader
    ? getGalleryHeaderState(photos)
    : undefined
  const displayedDate = hasFixedHeader
    ? fixedHeaderState?.date
    : headerState.date
  const displayedLocation = hasFixedHeader
    ? fixedHeaderLocation
    : headerState.location

  useEffect(() => {
    if (hasFixedHeader) {
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
  }, [hasFixedHeader])

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
      date: displayedDate,
      location: displayedLocation,
      showDate: !!displayedDate && (hasFixedHeader || showHeaderDetail),
    })
  }, [displayedDate, displayedLocation, hasFixedHeader, showHeaderDetail])

  useEffect(() => {
    return () => {
      publishGalleryHeaderDetail({ showDate: false })
    }
  }, [])

  const handleVisiblePhotosChange = (visiblePhotos: Photo[]) => {
    if (hasFixedHeader) {
      return
    }

    const nextHeaderState = getGalleryHeaderState(visiblePhotos)

    setHeaderState((currentState) => {
      if (
        currentState.date === nextHeaderState.date &&
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
