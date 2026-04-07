import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ThumbnailImage } from '@/components/gallery/thumbnail-image'
import { useMobile } from '@/hooks/use-mobile'
import type { GalleryPhoto } from '@/lib/photos'
import { cn } from '@/lib/style'
import { useHorizontalWheelScroll } from './hooks/use-horizontal-wheel-scroll'

const MOBILE_FALLBACK_THUMBNAIL_HEIGHT = 48
const DESKTOP_FALLBACK_THUMBNAIL_HEIGHT = 64
const THUMBNAIL_OVERSCAN = 6
const HOVER_PREVIEW_PADDING = 12
const HOVER_PREVIEW_MAX_WIDTH = 460
const HOVER_PREVIEW_MIN_HEIGHT = 180
const HOVER_PREVIEW_MAX_HEIGHT = 240

interface HoverPreviewState {
  index: number
  left: number
  width: number
  height: number
}

interface ThumbnailRailProps {
  photos: GalleryPhoto[]
  activeIndex: number
  onSelect: (index: number) => void
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getHoverPreviewSize(aspectRatio: number, shellWidth: number) {
  const maxWidth = Math.max(
    1,
    Math.min(
      HOVER_PREVIEW_MAX_WIDTH,
      Math.floor(shellWidth) - 2 * HOVER_PREVIEW_PADDING,
    ),
  )
  const maxHeight = clamp(
    Math.round(window.innerHeight * 0.24),
    HOVER_PREVIEW_MIN_HEIGHT,
    HOVER_PREVIEW_MAX_HEIGHT,
  )

  let width = maxWidth
  let height = Math.round(width / aspectRatio)

  if (height > maxHeight) {
    height = maxHeight
    width = Math.round(height * aspectRatio)
  }

  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
  }
}

export function ThumbnailRail({
  photos,
  activeIndex,
  onSelect,
}: ThumbnailRailProps) {
  const railShellRef = useRef<HTMLDivElement>(null)
  const railViewportRef = useRef<HTMLDivElement>(null)
  const isMobile = useMobile()
  const [thumbnailHeight, setThumbnailHeight] = useState(
    isMobile
      ? MOBILE_FALLBACK_THUMBNAIL_HEIGHT
      : DESKTOP_FALLBACK_THUMBNAIL_HEIGHT,
  )
  const [hoverPreview, setHoverPreview] = useState<HoverPreviewState | null>(
    null,
  )
  const hasCenteredInitialItemRef = useRef(false)

  useHorizontalWheelScroll(railViewportRef)

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

      return photo
        ? Math.max(1, Math.round(thumbnailHeight * photo.aspectRatio))
        : thumbnailHeight
    },
    [photos, thumbnailHeight],
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

  const updateHoverPreview = useCallback(
    (index: number, button: HTMLButtonElement) => {
      if (
        isMobile ||
        !window.matchMedia('(hover: hover) and (pointer: fine)').matches
      ) {
        return
      }

      const railShell = railShellRef.current
      const photo = photos[index]

      if (!railShell || !photo) {
        return
      }

      const shellRect = railShell.getBoundingClientRect()
      const buttonRect = button.getBoundingClientRect()
      const previewSize = getHoverPreviewSize(
        photo.aspectRatio,
        shellRect.width,
      )
      const rawLeft =
        buttonRect.left -
        shellRect.left +
        buttonRect.width / 2 -
        previewSize.width / 2
      const maxLeft = Math.max(
        HOVER_PREVIEW_PADDING,
        shellRect.width - previewSize.width - HOVER_PREVIEW_PADDING,
      )

      setHoverPreview({
        index,
        left: clamp(rawLeft, HOVER_PREVIEW_PADDING, maxLeft),
        width: previewSize.width,
        height: previewSize.height,
      })
    },
    [isMobile, photos],
  )

  const handleThumbnailEnter = useCallback(
    (index: number, event: React.MouseEvent<HTMLButtonElement>) => {
      updateHoverPreview(index, event.currentTarget)
    },
    [updateHoverPreview],
  )

  const handleThumbnailMove = useCallback(
    (index: number, event: React.MouseEvent<HTMLButtonElement>) => {
      updateHoverPreview(index, event.currentTarget)
    },
    [updateHoverPreview],
  )

  const handleThumbnailLeave = useCallback(() => {
    setHoverPreview(null)
  }, [])

  useEffect(() => {
    if (isMobile && hoverPreview) {
      setHoverPreview(null)
    }
  }, [hoverPreview, isMobile])

  const hoverPreviewPhoto = hoverPreview ? photos[hoverPreview.index] : null

  return (
    <div
      ref={railShellRef}
      className="bg-surface relative h-12 w-full shrink-0 lg:h-16"
    >
      {hoverPreview && hoverPreviewPhoto ? (
        <div
          className="bg-base motion-safe:animate-preview-enter pointer-events-none absolute bottom-full z-100 hidden origin-bottom overflow-hidden lg:block"
          style={{
            left: `${hoverPreview.left}px`,
            width: `${hoverPreview.width}px`,
            height: `${hoverPreview.height}px`,
          }}
        >
          <div className="relative size-full overflow-hidden">
            <ThumbnailImage
              photo={hoverPreviewPhoto}
              loading="eager"
              imageClassName="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </div>
      ) : null}

      <div
        ref={railViewportRef}
        className="scrollbar-hide h-full overflow-x-auto overflow-y-hidden"
        aria-label="Preview thumbnails"
        onScroll={handleThumbnailLeave}
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
            if (!photo) return null

            const index = virtualItem.index
            const isActive = index === activeIndex
            const isHover = index === hoverPreview?.index

            return (
              <button
                key={photo.id}
                type="button"
                className={cn(
                  'group transition-filter absolute top-0 cursor-pointer overflow-hidden duration-300 ease-out outline-none',
                  !(isActive || isHover) && 'grayscale',
                )}
                style={{
                  width: `${virtualItem.size}px`,
                  height: `${thumbnailHeight}px`,
                  transform: `translateX(${virtualItem.start}px)`,
                }}
                onClick={() => onSelect(index)}
                onMouseEnter={(event) => handleThumbnailEnter(index, event)}
                onMouseMove={(event) => handleThumbnailMove(index, event)}
                onMouseLeave={handleThumbnailLeave}
                aria-label={`Open ${photo.title}`}
                aria-current={isActive}
              >
                <ThumbnailImage
                  photo={photo}
                  loading="lazy"
                  blurClassName="object-contain opacity-60"
                  imageClassName="absolute inset-0 h-full w-full object-contain"
                />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
