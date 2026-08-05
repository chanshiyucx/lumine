import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual'
import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useScrollElement } from '@/components/scroll-area'
import type { Photo } from '@/lib/photo'
import {
  getMasonryLayout,
  getPhotoMasonryHeight,
  getVisibleMasonryIndexes,
  MASONRY_GAP,
  type MasonryLayout,
} from './lib/masonry-layout'
import { PhotoMasonryItem } from './photo-masonry-item'

const HEADER_HEIGHT = 48
const OVERSCAN_ROWS = 3

interface MeasuredMasonryLayout extends MasonryLayout {
  scrollMargin: number
}

interface PhotoMasonryProps {
  photos: Photo[]
  onPhotoOpen: (index: number, triggerElement: HTMLElement) => void
  onVisiblePhotosChange: (photos: Photo[]) => void
}

function arePhotoIdsEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((id, index) => id === right[index])
  )
}

function getScrollMargin(container: HTMLElement, scrollElement: HTMLElement) {
  const containerRect = container.getBoundingClientRect()
  const scrollRect = scrollElement.getBoundingClientRect()

  return containerRect.top - scrollRect.top + scrollElement.scrollTop
}

function useMasonryLayout(scrollElement: HTMLElement | null) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<MeasuredMasonryLayout | null>(null)

  useLayoutEffect(() => {
    const container = containerRef.current

    if (!container || !scrollElement) {
      return
    }

    let currentWidth = -1

    const updateLayout = (width: number) => {
      if (width === currentWidth) {
        return
      }

      currentWidth = width

      setLayout({
        ...getMasonryLayout(width),
        scrollMargin: getScrollMargin(container, scrollElement),
      })
    }

    const initialRect = container.getBoundingClientRect()
    updateLayout(initialRect.width)

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width !== currentWidth) {
        updateLayout(entry.contentRect.width)
      }
    })

    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [scrollElement])

  return { containerRef, layout }
}

function getVisiblePhotos(
  photos: Photo[],
  virtualizer: Virtualizer<HTMLElement, HTMLLIElement>,
  scrollElement: HTMLElement,
) {
  const scrollOffset = virtualizer.scrollOffset ?? scrollElement.scrollTop
  const indexes = getVisibleMasonryIndexes(
    virtualizer.getVirtualItems(),
    scrollOffset + HEADER_HEIGHT,
    scrollOffset + scrollElement.clientHeight,
  )

  return indexes.map((index) => photos[index])
}

export const PhotoMasonry = memo(function PhotoMasonry({
  photos,
  onPhotoOpen,
  onVisiblePhotosChange,
}: PhotoMasonryProps) {
  const scrollElement = useScrollElement()
  const { containerRef, layout } = useMasonryLayout(scrollElement)
  const lastVisiblePhotoIdsRef = useRef<string[] | null>(null)
  const isLayoutReady = scrollElement !== null && layout !== null
  const columnCount = layout?.columnCount ?? 1
  const columnWidth = layout?.columnWidth ?? 1

  const estimateSize = useCallback(
    (index: number) => getPhotoMasonryHeight(photos[index], columnWidth),
    [columnWidth, photos],
  )
  const getItemKey = useCallback((index: number) => photos[index].id, [photos])
  const handleVirtualizerChange = useCallback(
    (virtualizer: Virtualizer<HTMLElement, HTMLLIElement>) => {
      if (!scrollElement) {
        return
      }

      const visiblePhotos = getVisiblePhotos(photos, virtualizer, scrollElement)
      const visiblePhotoIds = visiblePhotos.map((photo) => photo.id)
      const previousVisiblePhotoIds = lastVisiblePhotoIdsRef.current

      if (
        previousVisiblePhotoIds &&
        arePhotoIdsEqual(previousVisiblePhotoIds, visiblePhotoIds)
      ) {
        return
      }

      lastVisiblePhotoIdsRef.current = visiblePhotoIds
      onVisiblePhotosChange(visiblePhotos)
    },
    [onVisiblePhotosChange, photos, scrollElement],
  )

  // TanStack Virtual owns its imperative state and cannot be memoized safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer<HTMLElement, HTMLLIElement>({
    count: photos.length,
    enabled: isLayoutReady,
    lanes: columnCount,
    gap: MASONRY_GAP,
    scrollMargin: layout?.scrollMargin ?? 0,
    overscan: columnCount * OVERSCAN_ROWS,
    estimateSize,
    getScrollElement: () => scrollElement,
    getItemKey,
    onChange: handleVirtualizerChange,
    directDomUpdates: true,
    useFlushSync: false,
  })

  useLayoutEffect(() => {
    if (isLayoutReady) {
      virtualizer.measure()
    }
  }, [columnCount, columnWidth, isLayoutReady, virtualizer])

  const sizeContainerRef = virtualizer.containerRef
  const measureItem = virtualizer.measureElement
  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div ref={containerRef} className="mt-12 w-full">
      {photos.length === 0 ? (
        <p className="text-subtle px-6 py-16 text-center" role="status">
          No photos available.
        </p>
      ) : (
        <ul
          ref={sizeContainerRef}
          className="relative m-0 list-none p-0"
          aria-label="Photos"
        >
          {virtualItems.map((virtualItem) => {
            const photo = photos[virtualItem.index]

            return (
              <li
                key={virtualItem.key}
                ref={measureItem}
                data-index={virtualItem.index}
                className="absolute top-0"
                style={{
                  left: virtualItem.lane * (columnWidth + MASONRY_GAP),
                  width: columnWidth,
                }}
              >
                <PhotoMasonryItem
                  photo={photo}
                  index={virtualItem.index}
                  onOpen={onPhotoOpen}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
})
