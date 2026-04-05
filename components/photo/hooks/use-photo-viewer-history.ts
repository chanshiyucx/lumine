'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getPhotoPath, type GalleryPhoto } from '@/lib/photos'
import { getPhotoIndexFromPathname } from '../lib/masonry-layout'

interface UsePhotoViewerHistoryOptions {
  photos: GalleryPhoto[]
  initialPhotoSlug?: string
}

export function usePhotoViewerHistory({
  photos,
  initialPhotoSlug,
}: UsePhotoViewerHistoryOptions) {
  const isHydratedRef = useRef(false)
  const pushedViewerStateRef = useRef(false)
  const previousActiveIndexRef = useRef<number | null>(null)
  const slugToIndex = useMemo(() => {
    return new Map(photos.map((photo, index) => [photo.slug, index]))
  }, [photos])
  const [activeIndex, setActiveIndex] = useState<number | null>(() => {
    if (!initialPhotoSlug) {
      return null
    }

    return slugToIndex.get(initialPhotoSlug) ?? null
  })

  const getIndexFromPathname = useCallback(
    (pathname: string) => {
      return getPhotoIndexFromPathname(pathname, slugToIndex)
    },
    [slugToIndex],
  )

  useEffect(() => {
    const syncFromLocation = () => {
      setActiveIndex(getIndexFromPathname(window.location.pathname))
    }

    syncFromLocation()
    window.addEventListener('popstate', syncFromLocation)

    return () => {
      window.removeEventListener('popstate', syncFromLocation)
    }
  }, [getIndexFromPathname])

  useEffect(() => {
    const nextPath =
      activeIndex === null ? '/' : getPhotoPath(photos[activeIndex]?.slug ?? '')

    if (!isHydratedRef.current) {
      isHydratedRef.current = true
      previousActiveIndexRef.current = activeIndex
      return
    }

    const currentPath = window.location.pathname
    const wasOpen = previousActiveIndexRef.current !== null

    if (currentPath !== nextPath) {
      if (activeIndex !== null) {
        if (!wasOpen && currentPath === '/') {
          window.history.pushState({ photoViewer: true }, '', nextPath)
          pushedViewerStateRef.current = true
        } else {
          window.history.replaceState({ photoViewer: true }, '', nextPath)
        }
      } else if (
        pushedViewerStateRef.current &&
        currentPath.startsWith('/photos/')
      ) {
        pushedViewerStateRef.current = false
        window.history.back()
      } else if (currentPath !== '/') {
        window.history.replaceState({}, '', '/')
      }
    }

    previousActiveIndexRef.current = activeIndex
  }, [activeIndex, photos])

  return {
    activeIndex,
    setActiveIndex,
  }
}
