'use client'

import { domAnimation, LazyMotion, MotionConfig } from 'motion/react'
import { useEffect, useState } from 'react'
import { publishGalleryHeaderDetail } from '@/components/header/lib/gallery-header-store'
import { useScrollElement } from '@/components/scroll-area'
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
  fixedHeaderDetail?: Required<GalleryHeaderState>
}

const HEADER_SCROLL_THRESHOLD = 500

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
  const [showHeaderDetail, setShowHeaderDetail] = useState(false)
  const [headerState, setHeaderState] = useState<GalleryHeaderState>({})
  const { date: displayedDate, location: displayedLocation } =
    fixedHeaderDetail ?? headerState

  useEffect(() => {
    if (hasFixedHeader || !scrollElement) {
      return
    }

    const handleScroll = () => {
      setShowHeaderDetail(scrollElement.scrollTop > HEADER_SCROLL_THRESHOLD)
    }

    handleScroll()
    scrollElement.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll)
    }
  }, [hasFixedHeader, scrollElement])

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

  const handleVisiblePhotoChange = (visiblePhoto: Photo | undefined) => {
    const nextHeaderState = getGalleryHeaderState(visiblePhoto)

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
      </MotionConfig>
    </LazyMotion>
  )
}
