'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getPhotoPath, type Photo } from '@/lib/photos'
import { getPhotoIndexFromPathname } from '../../gallery/lib/masonry-layout'

interface UseViewerHistoryOptions {
  photos: Photo[]
  initialPhotoSlug?: string
}

export function useViewerHistory({
  photos,
  initialPhotoSlug,
}: UseViewerHistoryOptions) {
  const isHydratedRef = useRef(false)
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
      return
    }

    const currentPath = window.location.pathname

    if (currentPath !== nextPath) {
      window.history.pushState(
        { photoViewer: activeIndex !== null },
        '',
        nextPath,
      )
    }
  }, [activeIndex, photos])

  return {
    activeIndex,
    setActiveIndex,
  }
}
