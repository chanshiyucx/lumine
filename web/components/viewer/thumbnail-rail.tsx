import { useVirtualizer } from '@tanstack/react-virtual'
import { useReducedMotion } from 'motion/react'
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { ThumbnailImage } from '@/components/image'
import { useMobile } from '@/hooks/use-mobile'
import { clamp } from '@/lib/math'
import type { Photo } from '@/lib/photo'
import { cn } from '@/lib/style'
import { useHorizontalWheelScroll } from './hooks/use-horizontal-wheel-scroll'

const MOBILE_THUMBNAIL_HEIGHT = 48
const DESKTOP_THUMBNAIL_HEIGHT = 64
const THUMBNAIL_OVERSCAN = 6
const HOVER_PREVIEW_OPEN_DELAY = 100
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
  photos: Photo[]
  activeIndex: number
  onSelect: (index: number) => void
}

function getHoverPreviewLayout(
  aspectRatio: number,
  shellWidth: number,
  viewportHeight: number,
  anchorCenter: number,
) {
  const maxWidth = Math.max(
    1,
    Math.min(
      HOVER_PREVIEW_MAX_WIDTH,
      Math.floor(shellWidth) - 2 * HOVER_PREVIEW_PADDING,
    ),
  )
  const maxHeight = clamp(
    Math.round(viewportHeight * 0.24),
    HOVER_PREVIEW_MIN_HEIGHT,
    HOVER_PREVIEW_MAX_HEIGHT,
  )

  let width = maxWidth
  let height = Math.round(width / aspectRatio)

  if (height > maxHeight) {
    height = maxHeight
    width = Math.round(height * aspectRatio)
  }

  width = Math.max(1, width)
  height = Math.max(1, height)
  const left = clamp(
    anchorCenter - width / 2,
    HOVER_PREVIEW_PADDING,
    Math.max(HOVER_PREVIEW_PADDING, shellWidth - width - HOVER_PREVIEW_PADDING),
  )

  return { left, width, height }
}

export const ThumbnailRail = memo(function ThumbnailRail({
  photos,
  activeIndex,
  onSelect,
}: ThumbnailRailProps) {
  const railShellRef = useRef<HTMLDivElement>(null)
  const railViewportRef = useRef<HTMLDivElement>(null)
  const hasCenteredInitialItemRef = useRef(false)
  const hoverPreviewTimerRef = useRef<number | null>(null)
  const isMobile = useMobile()
  const reduceMotion = useReducedMotion()
  const thumbnailHeight = isMobile
    ? MOBILE_THUMBNAIL_HEIGHT
    : DESKTOP_THUMBNAIL_HEIGHT
  const [hoverPreview, setHoverPreview] = useState<HoverPreviewState | null>(
    null,
  )

  useHorizontalWheelScroll(railViewportRef)

  const estimateSize = (index: number) => {
    const photo = photos[index]

    return photo
      ? Math.max(1, Math.round(thumbnailHeight * photo.aspectRatio))
      : thumbnailHeight
  }
  const getItemKey = useCallback(
    (index: number) => photos[index]?.id ?? index,
    [photos],
  )

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual manages imperative scroll state internally and stays local to this component.
  const virtualizer = useVirtualizer({
    count: photos.length,
    getScrollElement: () => railViewportRef.current,
    estimateSize,
    horizontal: true,
    overscan: THUMBNAIL_OVERSCAN,
    getItemKey,
  })

  useLayoutEffect(() => {
    virtualizer.measure()
  }, [thumbnailHeight, virtualizer])

  useEffect(() => {
    if (photos.length === 0) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      virtualizer.scrollToIndex(activeIndex, {
        align: 'center',
        behavior:
          hasCenteredInitialItemRef.current && !reduceMotion
            ? 'smooth'
            : 'auto',
      })

      hasCenteredInitialItemRef.current = true
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [activeIndex, photos.length, reduceMotion, virtualizer])

  const cancelHoverPreviewTimer = () => {
    if (hoverPreviewTimerRef.current !== null) {
      window.clearTimeout(hoverPreviewTimerRef.current)
      hoverPreviewTimerRef.current = null
    }
  }

  const scheduleHoverPreview = (index: number, button: HTMLButtonElement) => {
    cancelHoverPreviewTimer()
    if (
      isMobile ||
      !window.matchMedia('(hover: hover) and (pointer: fine)').matches
    ) {
      return
    }

    hoverPreviewTimerRef.current = window.setTimeout(() => {
      hoverPreviewTimerRef.current = null
      if (!button.isConnected || !button.matches(':hover')) {
        return
      }

      const railShell = railShellRef.current
      const photo = photos[index]

      if (!railShell || !photo) {
        return
      }

      const shellRect = railShell.getBoundingClientRect()
      const buttonRect = button.getBoundingClientRect()
      const layout = getHoverPreviewLayout(
        photo.aspectRatio,
        shellRect.width,
        window.innerHeight,
        buttonRect.left - shellRect.left + buttonRect.width / 2,
      )

      setHoverPreview({ index, ...layout })
    }, HOVER_PREVIEW_OPEN_DELAY)
  }

  const clearHoverPreview = () => {
    cancelHoverPreviewTimer()
    setHoverPreview(null)
  }

  useEffect(() => {
    if (isMobile) {
      setHoverPreview(null)
    }

    return cancelHoverPreviewTimer
  }, [isMobile])

  const hoverPreviewPhoto = hoverPreview ? photos[hoverPreview.index] : null

  return (
    <div
      ref={railShellRef}
      className="bg-surface relative h-[calc(3rem+env(safe-area-inset-bottom))] w-full shrink-0 pb-[env(safe-area-inset-bottom)] lg:h-16 lg:pb-0"
    >
      {hoverPreview && hoverPreviewPhoto ? (
        <div
          className="bg-base motion-safe:animate-preview-enter pointer-events-none absolute bottom-full z-100 hidden origin-bottom overflow-hidden lg:block"
          style={{
            left: hoverPreview.left,
            width: hoverPreview.width,
            height: hoverPreview.height,
          }}
        >
          <ThumbnailImage photo={hoverPreviewPhoto} loading="eager" />
        </div>
      ) : null}

      <div
        ref={railViewportRef}
        className="scrollbar-hide h-full overflow-x-auto overflow-y-hidden"
        aria-label="Preview thumbnails"
        tabIndex={-1}
        onScroll={clearHoverPreview}
      >
        <div
          className="relative"
          style={{
            height: thumbnailHeight,
            width: virtualizer.getTotalSize(),
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const photo = photos[virtualItem.index]
            if (!photo) return null

            const index = virtualItem.index
            const isActive = index === activeIndex

            return (
              <button
                key={photo.id}
                type="button"
                tabIndex={-1}
                className={cn(
                  'transition-filter absolute top-0 cursor-pointer appearance-none overflow-hidden duration-300 ease-out motion-reduce:transition-none',
                  !isActive && 'grayscale lg:hover:grayscale-0',
                )}
                style={{
                  width: virtualItem.size,
                  height: thumbnailHeight,
                  transform: `translateX(${virtualItem.start}px)`,
                }}
                onClick={() => onSelect(index)}
                onMouseEnter={(event) =>
                  scheduleHoverPreview(index, event.currentTarget)
                }
                onMouseLeave={clearHoverPreview}
                aria-label={`Open ${photo.title}`}
                aria-current={isActive}
              >
                <ThumbnailImage photo={photo} fit="contain" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
})
