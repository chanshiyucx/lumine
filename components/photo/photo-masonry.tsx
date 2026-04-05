'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getPhotoPath, type GalleryPhoto } from '@/lib/photos'
import { PhotoCard } from './photo-card'
import { getColumnConfig, type PositionedPhoto } from './photo-masonry.utils'
import { PhotoViewer } from './photo-viewer'

interface PhotoMasonryProps {
  photos: GalleryPhoto[]
  initialPhotoSlug?: string
}

export function PhotoMasonry({ photos, initialPhotoSlug }: PhotoMasonryProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
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
      const match = /^\/photos\/([^/]+)$/.exec(pathname)

      if (!match) {
        return null
      }

      return slugToIndex.get(decodeURIComponent(match[1])) ?? null
    },
    [slugToIndex],
  )

  useEffect(() => {
    const node = containerRef.current

    if (!node) {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const nextWidth = Math.floor(entries[0]?.contentRect.width ?? 0)

      setContainerWidth((currentWidth) => {
        if (currentWidth === nextWidth) {
          return currentWidth
        }

        return nextWidth
      })
    })

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [])

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

  const { columns, gap } = useMemo(() => {
    if (photos.length === 0) {
      return { columns: [] as PositionedPhoto[][], gap: 12 }
    }

    if (containerWidth === 0) {
      return {
        columns: [photos.map((photo, index) => ({ photo, index }))],
        gap: 12,
      }
    }

    const config = getColumnConfig(containerWidth)
    const columnCount = Math.max(
      1,
      Math.min(
        config.maxColumns,
        Math.floor(
          (containerWidth + config.gap) / (config.preferredWidth + config.gap),
        ),
      ),
    )

    const itemWidth =
      (containerWidth - config.gap * Math.max(0, columnCount - 1)) / columnCount
    const columnHeights = Array.from({ length: columnCount }, () => 0)
    const nextColumns = Array.from(
      { length: columnCount },
      () => [] as PositionedPhoto[],
    )

    for (const [index, photo] of photos.entries()) {
      let targetColumn = 0

      for (let columnIndex = 1; columnIndex < columnCount; columnIndex += 1) {
        if (columnHeights[columnIndex] < columnHeights[targetColumn]) {
          targetColumn = columnIndex
        }
      }

      nextColumns[targetColumn].push({ photo, index })
      columnHeights[targetColumn] += itemWidth / photo.aspectRatio + config.gap
    }

    return { columns: nextColumns, gap: config.gap }
  }, [containerWidth, photos])

  const handleOpen = useCallback((index: number) => {
    setActiveIndex(index)
  }, [])

  const handleClose = useCallback(() => {
    setActiveIndex(null)
  }, [])

  const handleChange = useCallback((index: number) => {
    setActiveIndex(index)
  }, [])

  return (
    <>
      <div className="relative min-h-screen w-full max-w-full overflow-x-clip">
        <main className="w-full max-w-full overflow-x-clip">
          <div
            ref={containerRef}
            role="grid"
            aria-label="Photo Masonry"
            className="flex w-full max-w-full items-start"
            style={{ gap }}
          >
            {columns.map((column, columnIndex) => (
              <div
                key={columnIndex}
                className="flex min-w-0 flex-1 flex-col"
                style={{ gap }}
              >
                {column.map(({ photo, index }) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    index={index}
                    onOpen={handleOpen}
                  />
                ))}
              </div>
            ))}
          </div>
        </main>
      </div>

      {activeIndex !== null ? (
        <PhotoViewer
          photos={photos}
          activeIndex={activeIndex}
          onClose={handleClose}
          onChange={handleChange}
        />
      ) : null}
    </>
  )
}
