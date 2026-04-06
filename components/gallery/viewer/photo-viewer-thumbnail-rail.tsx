import { useVirtualizer } from '@tanstack/react-virtual'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from 'react'
import type { GalleryPhoto } from '@/lib/photos'
import { cn } from '@/lib/style'
import { useMobile } from '../hooks/use-mobile'
import { PhotoThumbnailImage } from '../photo-thumbnail-image'

const MOBILE_MIN_THUMBNAIL_WIDTH = 48
const DESKTOP_MIN_THUMBNAIL_WIDTH = 72
const MOBILE_FALLBACK_THUMBNAIL_HEIGHT = 48
const DESKTOP_FALLBACK_THUMBNAIL_HEIGHT = 64
const THUMBNAIL_OVERSCAN = 6

interface PhotoViewerThumbnailRailProps {
  photos: GalleryPhoto[]
  activeIndex: number
  hoverPreviewIndex: number | null
  railShellRef: RefObject<HTMLDivElement | null>
  railViewportRef: RefObject<HTMLDivElement | null>
  onSelect: (index: number) => void
  onThumbnailEnter: (
    index: number,
    event: MouseEvent<HTMLButtonElement>,
  ) => void
  onThumbnailMove: (index: number, event: MouseEvent<HTMLButtonElement>) => void
  onThumbnailLeave: () => void
}

export function PhotoViewerThumbnailRail({
  photos,
  activeIndex,
  hoverPreviewIndex,
  railShellRef,
  railViewportRef,
  onSelect,
  onThumbnailEnter,
  onThumbnailMove,
  onThumbnailLeave,
}: PhotoViewerThumbnailRailProps) {
  const isMobile = useMobile()
  const [thumbnailHeight, setThumbnailHeight] = useState(
    isMobile
      ? MOBILE_FALLBACK_THUMBNAIL_HEIGHT
      : DESKTOP_FALLBACK_THUMBNAIL_HEIGHT,
  )
  const hasCenteredInitialItemRef = useRef(false)

  useEffect(() => {
    const viewport = railViewportRef.current

    if (!viewport) {
      return
    }

    const syncHeight = () => {
      const nextHeight = Math.max(1, Math.floor(viewport.clientHeight))

      setThumbnailHeight((currentHeight) => {
        if (currentHeight === nextHeight) {
          return currentHeight
        }

        return nextHeight
      })
    }

    syncHeight()

    const observer = new ResizeObserver(() => {
      syncHeight()
    })

    observer.observe(viewport)

    return () => {
      observer.disconnect()
    }
  }, [railViewportRef])

  const estimateSize = useCallback(
    (index: number) => {
      const photo = photos[index]
      const minThumbnailWidth = isMobile
        ? MOBILE_MIN_THUMBNAIL_WIDTH
        : DESKTOP_MIN_THUMBNAIL_WIDTH

      return photo
        ? Math.max(
            minThumbnailWidth,
            Math.round(thumbnailHeight * photo.aspectRatio),
          )
        : thumbnailHeight
    },
    [isMobile, photos, thumbnailHeight],
  )

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual manages imperative scroll state internally and stays local to this component.
  const virtualizer = useVirtualizer({
    count: photos.length,
    getScrollElement: () => railViewportRef.current,
    estimateSize,
    horizontal: true,
    overscan: THUMBNAIL_OVERSCAN,
    getItemKey: (index) => photos[index]?.id ?? index,
  })

  useEffect(() => {
    if (photos.length === 0) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      virtualizer.scrollToIndex(activeIndex, {
        align: 'center',
        behavior: hasCenteredInitialItemRef.current ? 'smooth' : 'auto',
      })

      hasCenteredInitialItemRef.current = true
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [activeIndex, photos.length, virtualizer])

  return (
    <div
      ref={railShellRef}
      className="bg-base/88 relative h-12 w-full shrink-0 backdrop-blur-xl lg:h-16"
    >
      <div
        ref={railViewportRef}
        className="h-full overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Preview thumbnails"
      >
        <div
          className="relative"
          style={{
            height: `${thumbnailHeight}px`,
            width: `${virtualizer.getTotalSize()}px`,
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const photo = photos[virtualItem.index]

            if (!photo) {
              return null
            }

            const index = virtualItem.index
            const isActive = index === activeIndex
            const isHovered = hoverPreviewIndex === index

            return (
              <button
                key={photo.id}
                type="button"
                className={cn(
                  'group absolute top-0 overflow-hidden transition-[filter,opacity] duration-300 ease-out focus:outline-none focus-visible:outline-none',
                  isActive
                    ? 'z-10 opacity-100 grayscale-0'
                    : isHovered
                      ? 'opacity-100 grayscale-0'
                      : 'opacity-72 grayscale hover:opacity-92',
                )}
                style={{
                  width: `${virtualItem.size}px`,
                  height: `${thumbnailHeight}px`,
                  transform: `translateX(${virtualItem.start}px)`,
                }}
                onClick={() => onSelect(index)}
                onMouseEnter={(event) => onThumbnailEnter(index, event)}
                onMouseMove={(event) => onThumbnailMove(index, event)}
                onMouseLeave={onThumbnailLeave}
                aria-label={`Open ${photo.title}`}
                aria-current={isActive}
              >
                <PhotoThumbnailImage
                  photo={photo}
                  loading="lazy"
                  imageClassName="absolute inset-0 h-full w-full object-cover"
                />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
