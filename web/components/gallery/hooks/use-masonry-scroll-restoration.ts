import { useLayoutEffect, useRef, useState } from 'react'
import { isPhotoPathname } from '@/lib/route-paths'
import type { MasonryLayout } from '../lib/masonry-layout'

interface SavedScrollPosition {
  scrollTop: number
  // Masonry height scales with columnWidth / columnCount.
  columnScale: number
}

const savedPositions = new Map<string, SavedScrollPosition>()
let mountedPageKey: string | null = null
let traversedPageKey: string | null = null

function getPageKey() {
  return `${window.location.pathname}${window.location.search}`
}

function readRestoredPosition() {
  if (typeof window === 'undefined' || traversedPageKey === null) {
    return null
  }

  return savedPositions.get(traversedPageKey) ?? null
}

if (typeof window !== 'undefined') {
  // Capture runs before Next's listener, which may render the page synchronously.
  window.addEventListener(
    'popstate',
    () => {
      const pageKey = getPageKey()
      // The viewer moves between photo URLs and its gallery's URL without
      // remounting the masonry; anything else lands on another page.
      const isViewerTraversal =
        mountedPageKey !== null &&
        (pageKey === mountedPageKey ||
          isPhotoPathname(window.location.pathname) ||
          isPhotoPathname(window.location.pathname, 'private'))
      if (!isViewerTraversal) {
        traversedPageKey = pageKey
      }
    },
    { capture: true },
  )
}

// Restores the masonry position on back/forward navigation. The result is
// TanStack's initialOffset, which it scrolls to when it attaches.
export function useMasonryScrollRestoration(
  scrollElement: HTMLElement | null,
  layout: MasonryLayout | null,
) {
  const [restoredPosition] = useState(readRestoredPosition)
  const pageKeyRef = useRef('')
  const columnScale = layout ? layout.columnWidth / layout.columnCount : null

  useLayoutEffect(() => {
    // Read here: Next updates the URL after rendering a pushed page.
    pageKeyRef.current = getPageKey()
    if (!restoredPosition) {
      savedPositions.delete(pageKeyRef.current)
    }
    traversedPageKey = null
    mountedPageKey = pageKeyRef.current

    return () => {
      mountedPageKey = null
    }
  }, [restoredPosition])

  // A layout effect stops saving before the next page resets the shared scroller.
  useLayoutEffect(() => {
    if (!scrollElement || columnScale === null) {
      return
    }

    const savePosition = () => {
      savedPositions.set(pageKeyRef.current, {
        scrollTop: scrollElement.scrollTop,
        columnScale,
      })
    }
    scrollElement.addEventListener('scroll', savePosition, { passive: true })

    return () => scrollElement.removeEventListener('scroll', savePosition)
  }, [scrollElement, columnScale])

  return () =>
    restoredPosition && columnScale !== null
      ? (restoredPosition.scrollTop * columnScale) /
        restoredPosition.columnScale
      : 0
}
