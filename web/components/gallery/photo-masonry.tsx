import {
  defaultRangeExtractor,
  observeElementRect,
  useVirtualizer,
  type Range,
  type Virtualizer,
} from '@tanstack/react-virtual'
import {
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
} from 'react'
import { useScrollElement } from '@/components/scroll-area'
import { useMediaQuery } from '@/hooks/use-media-query'
import type { Photo } from '@/lib/photo'
import { useMasonryScrollRestoration } from './hooks/use-masonry-scroll-restoration'
import {
  getDominantMasonryPhoto,
  getMasonryLayout,
  getPhotoMasonryHeight,
  MASONRY_GAP,
  type MasonryLayout,
} from './lib/masonry-layout'
import { PhotoMasonryItem } from './photo-masonry-item'

// Matches the fixed header's `h-12`.
const HEADER_HEIGHT = 48
const OVERSCAN_ROWS = 3
const INITIAL_EAGER_ITEMS_PER_COLUMN = 3
// Matches the media query Tailwind v4 wraps around hover and group-hover.
const HOVER_QUERY = '(hover: hover)'

interface MeasuredMasonryLayout extends MasonryLayout {
  scrollMargin: number
}

interface PhotoMasonryProps {
  photos: Photo[]
  onPhotoOpen: (index: number, triggerElement: HTMLElement) => void
  onVisiblePhotoChange?: (photo: Photo | undefined) => void
}

function getFocusedIndex(target: Element) {
  const index = target.closest('li')?.dataset.index

  return index === undefined ? null : Number(index)
}

function getScrollMargin(container: HTMLElement, scrollElement: HTMLElement) {
  const containerRect = container.getBoundingClientRect()
  const scrollRect = scrollElement.getBoundingClientRect()

  return containerRect.top - scrollRect.top + scrollElement.scrollTop
}

const observeScrollRect: typeof observeElementRect = (
  virtualizer,
  onChange,
) => {
  return observeElementRect(virtualizer, (rect) => {
    // Virtualization needs visible height; the scroll area can briefly report full content height.
    const viewportHeight =
      virtualizer.scrollElement?.ownerDocument.documentElement.clientHeight
    onChange({
      ...rect,
      height: Math.min(rect.height, viewportHeight ?? rect.height),
    })
  })
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
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const canHover = useMediaQuery(HOVER_QUERY)
  const isLayoutReady = scrollElement !== null && layout !== null
  const columnCount = layout?.columnCount ?? 1
  const columnWidth = layout?.columnWidth ?? 1
  const scrollMargin = layout?.scrollMargin ?? 0
  const getInitialOffset = useMasonryScrollRestoration(scrollElement, layout)

  const estimateSize = (index: number) =>
    getPhotoMasonryHeight(photos[index], columnWidth)
  const getItemKey = useCallback((index: number) => photos[index].id, [photos])
  // Keep the focused card and its neighbors mounted so scrolling away does not
  // drop focus to the body, and Tab / Shift+Tab still reach the adjacent card.
  const rangeExtractor = useCallback(
    (range: Range) => {
      const indexes = defaultRangeExtractor(range)
      if (focusedIndex === null) {
        return indexes
      }

      const missing = [focusedIndex - 1, focusedIndex, focusedIndex + 1].filter(
        (index) =>
          index >= 0 && index < range.count && !indexes.includes(index),
      )

      return missing.length === 0
        ? indexes
        : [...indexes, ...missing].sort((left, right) => left - right)
    },
    [focusedIndex],
  )
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
        selectedPhotoRef.current?.album.key,
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
    observeElementRect: observeScrollRect,
    getItemKey,
    rangeExtractor,
    initialOffset: getInitialOffset,
    onChange: onVisiblePhotoChange ? handleVirtualizerChange : undefined,
    useFlushSync: false,
  })

  // TanStack caches measurements without tracking estimateSize, so a column
  // width change within the same column count needs an explicit re-measure.
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

  const handleFocus = (event: FocusEvent<HTMLUListElement>) => {
    setFocusedIndex(getFocusedIndex(event.target))
  }

  const handleBlur = (event: FocusEvent<HTMLUListElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setFocusedIndex(null)
    }
  }

  return (
    <div ref={containerRef}>
      <ul
        className="relative"
        style={{ height: virtualizer.getTotalSize() }}
        // Preflight's `list-style: none` makes Safari drop the list role.
        role="list"
        aria-label="Photos"
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        {virtualItems.map((virtualItem) => {
          const photo = photos[virtualItem.index]
          return (
            <li
              key={virtualItem.key}
              data-index={virtualItem.index}
              aria-posinset={virtualItem.index + 1}
              aria-setsize={photos.length}
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
                imageLoading={
                  virtualItem.index <
                  columnCount * INITIAL_EAGER_ITEMS_PER_COLUMN
                    ? 'eager'
                    : 'lazy'
                }
                showHoverInfo={canHover}
                onOpen={onPhotoOpen}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
})
