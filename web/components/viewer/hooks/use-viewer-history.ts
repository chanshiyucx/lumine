import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getPhotoPath, type Photo } from '@/lib/photo'
import { decodePathSegment } from '@/lib/url-segments'

interface UseViewerHistoryOptions {
  photos: Photo[]
  initialPhotoSlug?: string
  basePath?: string
}

function getPhotoIndexFromPathname(
  pathname: string,
  slugToIndex: Map<string, number>,
) {
  const match = /^\/photos\/([^/]+)$/.exec(pathname)

  if (!match) {
    return null
  }

  return slugToIndex.get(decodePathSegment(match[1])) ?? null
}

export function useViewerHistory({
  photos,
  initialPhotoSlug,
  basePath = '/',
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
      activeIndex === null
        ? basePath
        : getPhotoPath(photos[activeIndex]?.slug ?? '')

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
  }, [activeIndex, basePath, photos])

  return {
    activeIndex,
    setActiveIndex,
  }
}
