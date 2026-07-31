'use client'

import { domAnimation, LazyMotion, MotionConfig } from 'motion/react'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { publishGalleryHeaderDetail } from '@/components/header/gallery-header-events'
import { useViewerController, Viewer } from '@/components/viewer'
import type { Photo } from '@/lib/photo'
import {
  getGalleryHeaderState,
  type GalleryHeaderState,
} from './lib/gallery-header-state'
import type { MasonryGridProps } from './masonry-grid'

const MasonryGrid = dynamic<MasonryGridProps>(
  () => import('./masonry-grid').then((mod) => mod.MasonryGrid),
  {
    ssr: false,
  },
)

interface PhotoGalleryProps {
  photos: Photo[]
  initialPhotoSlug?: string
}

const HEADER_SCROLL_THRESHOLD = 500

export function PhotoGallery({ photos, initialPhotoSlug }: PhotoGalleryProps) {
  const viewer = useViewerController({
    photos,
    initialPhotoSlug,
  })
  const isViewerMounted = viewer.state.activeIndex !== null
  const [showHeaderDetail, setShowHeaderDetail] = useState(false)
  const [headerState, setHeaderState] = useState<GalleryHeaderState>({})

  useEffect(() => {
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
  }, [])

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
      ...headerState,
      showDateRange: showHeaderDetail && !!headerState.dateRange,
    })
  }, [headerState, showHeaderDetail])

  useEffect(() => {
    return () => {
      publishGalleryHeaderDetail({ showDateRange: false })
    }
  }, [])

  const handleVisiblePhotosChange = useCallback((visiblePhotos: Photo[]) => {
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
  }, [])

  const gridProps = useMemo<MasonryGridProps>(
    () => ({
      photos,
      onOpen: viewer.open,
      onVisiblePhotosChange: handleVisiblePhotosChange,
    }),
    [handleVisiblePhotosChange, photos, viewer.open],
  )

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <div data-gallery-root inert={isViewerMounted} tabIndex={-1}>
          <MasonryGrid {...gridProps} />
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
