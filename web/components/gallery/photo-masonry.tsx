import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual'
import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useScrollElement } from '@/components/scroll-area'
import type { Photo } from '@/lib/photo'
import {
  getDominantMasonryPhoto,
  getMasonryImageLoading,
  getMasonryLayout,
  getPhotoMasonryHeight,
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
  onVisiblePhotoChange?: (photo: Photo | undefined) => void
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

export const PhotoMasonry = memo(function PhotoMasonry({
  photos,
  onPhotoOpen,
  onVisiblePhotoChange,
}: PhotoMasonryProps) {
  const scrollElement = useScrollElement()
  const { containerRef, layout } = useMasonryLayout(scrollElement)
  const selectedPhotoRef = useRef<Photo | undefined>(undefined)
  const isLayoutReady = scrollElement !== null && layout !== null
  const columnCount = layout?.columnCount ?? 1
  const columnWidth = layout?.columnWidth ?? 1
  const scrollMargin = layout?.scrollMargin ?? 0

  const estimateSize = (index: number) =>
    getPhotoMasonryHeight(photos[index], columnWidth)
  const getItemKey = useCallback((index: number) => photos[index].id, [photos])
  const handleVirtualizerChange = useCallback(
    (virtualizer: Virtualizer<HTMLElement, HTMLLIElement>) => {
      if (!scrollElement || !onVisiblePhotoChange) {
        return
      }

      const scrollOffset = virtualizer.scrollOffset ?? scrollElement.scrollTop
      const photo = getDominantMasonryPhoto(
        photos,
        virtualizer.getVirtualItems(),
        scrollOffset + HEADER_HEIGHT,
        scrollOffset + scrollElement.clientHeight,
        columnCount,
        selectedPhotoRef.current?.albumKey,
      )
      if (photo !== selectedPhotoRef.current) {
        selectedPhotoRef.current = photo
        onVisiblePhotoChange(photo)
      }
    },
    [photos, scrollElement, columnCount, onVisiblePhotoChange],
  )

  // TanStack Virtual owns its imperative state and cannot be memoized safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer<HTMLElement, HTMLLIElement>({
    count: photos.length,
    enabled: isLayoutReady,
    lanes: columnCount,
    gap: MASONRY_GAP,
    scrollMargin,
    overscan: columnCount * OVERSCAN_ROWS,
    estimateSize,
    getScrollElement: () => scrollElement,
    getItemKey,
    onChange: onVisiblePhotoChange ? handleVirtualizerChange : undefined,
    useFlushSync: false,
  })

  useLayoutEffect(() => {
    if (isLayoutReady) {
      virtualizer.measure()
    }
  }, [columnCount, columnWidth, isLayoutReady, virtualizer])

  useLayoutEffect(() => {
    if (isLayoutReady) {
      handleVirtualizerChange(virtualizer)
    }
  }, [isLayoutReady, virtualizer, handleVirtualizerChange])

  const virtualItems = virtualizer.getVirtualItems()
  const scrollOffset = virtualizer.scrollOffset ?? scrollElement?.scrollTop ?? 0
  const viewportStart = scrollOffset + HEADER_HEIGHT
  const viewportEnd = scrollOffset + (scrollElement?.clientHeight ?? 0)

  return (
    <div ref={containerRef}>
      <ul
        className="relative"
        style={{ height: virtualizer.getTotalSize() }}
        aria-label="Photos"
      >
        {virtualItems.map((virtualItem) => {
          const photo = photos[virtualItem.index]
          return (
            <li
              key={virtualItem.key}
              data-index={virtualItem.index}
              className="absolute"
              style={{
                top: virtualItem.start - scrollMargin,
                left: virtualItem.lane * (columnWidth + MASONRY_GAP),
                width: columnWidth,
              }}
            >
              <PhotoMasonryItem
                photo={photo}
                index={virtualItem.index}
                cardHeight={virtualItem.size}
                imageLoading={getMasonryImageLoading(
                  virtualItem,
                  viewportStart,
                  viewportEnd,
                )}
                onOpen={onPhotoOpen}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
})
