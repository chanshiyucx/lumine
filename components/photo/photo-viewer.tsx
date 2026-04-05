'use client'

/* eslint-disable @next/next/no-img-element */
import {
  ChevronLeft,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GalleryPhoto } from '@/lib/photos'
import { cn } from '@/lib/style'
import { useBodyScrollLock } from './hooks/use-body-scroll-lock'
import { useHorizontalWheelScroll } from './hooks/use-horizontal-wheel-scroll'
import { useHoverPreview } from './hooks/use-hover-preview'
import { usePhotoViewerKeyboardNavigation } from './hooks/use-photo-viewer-keyboard-navigation'
import { PhotoProgressiveView } from './photo-progressive-view'
import { PhotoViewerHoverPreview } from './viewer/photo-viewer-hover-preview'
import { PhotoViewerInfoPanel } from './viewer/photo-viewer-info-panel'
import { PhotoViewerThumbnailRail } from './viewer/photo-viewer-thumbnail-rail'

interface PhotoViewerProps {
  photos: GalleryPhoto[]
  activeIndex: number
  onClose: () => void
  onChange: (index: number) => void
}

export function PhotoViewer({
  photos,
  activeIndex,
  onClose,
  onChange,
}: PhotoViewerProps) {
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([])
  const railViewportRef = useRef<HTMLDivElement>(null)
  const railShellRef = useRef<HTMLDivElement>(null)
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(true)
  const [loadedThumbnailUrls, setLoadedThumbnailUrls] = useState<Set<string>>(
    () => new Set(),
  )

  const currentPhoto = photos[activeIndex]
  const canGoPrevious = activeIndex > 0
  const canGoNext = activeIndex < photos.length - 1
  const {
    hoverPreview,
    handleThumbnailEnter,
    handleThumbnailMove,
    handleThumbnailLeave,
  } = useHoverPreview(photos, railShellRef)

  useBodyScrollLock()
  useHorizontalWheelScroll(railViewportRef)

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= photos.length) {
        return
      }

      onChange(index)
    },
    [onChange, photos.length],
  )

  usePhotoViewerKeyboardNavigation({
    activeIndex,
    onClose,
    onGoTo: goTo,
  })

  useEffect(() => {
    const currentThumbnail = thumbnailRefs.current[activeIndex]

    currentThumbnail?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [activeIndex])

  const markThumbnailLoaded = useCallback((thumbnailUrl: string) => {
    setLoadedThumbnailUrls((current) => {
      if (current.has(thumbnailUrl)) {
        return current
      }

      const next = new Set(current)
      next.add(thumbnailUrl)
      return next
    })
  }, [])

  const portalRoot = typeof document === 'undefined' ? null : document.body
  const hoverPreviewPhoto = hoverPreview ? photos[hoverPreview.index] : null
  const isHoverPreviewImageLoaded = hoverPreviewPhoto
    ? loadedThumbnailUrls.has(hoverPreviewPhoto.thumbnail.url)
    : false

  if (!portalRoot) {
    return null
  }

  return createPortal(
    <div
      className="bg-base fixed inset-0 z-[80] [animation:viewer-enter_220ms_cubic-bezier(0.16,1,0.3,1)] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${currentPhoto.title}`}
    >
      <button
        type="button"
        className="bg-base/94 absolute inset-0"
        onClick={onClose}
        aria-label="Close preview"
      />

      <img
        src={currentPhoto.blurDataUrl}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 scale-110 opacity-35 blur-3xl"
      />

      {hoverPreview && hoverPreviewPhoto ? (
        <PhotoViewerHoverPreview
          photo={hoverPreviewPhoto}
          preview={hoverPreview}
          isImageLoaded={isHoverPreviewImageLoaded}
          onThumbnailLoad={markThumbnailLoaded}
        />
      ) : null}

      <div className="absolute inset-0 flex min-h-0 min-w-0 flex-col">
        <div className="flex min-h-0 min-w-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1">
            <section className="bg-base relative min-h-0 min-w-0 flex-1 overflow-hidden">
              <div className="absolute top-0 right-0 z-40 flex">
                <button
                  type="button"
                  className="border-subtle/18 bg-overlay/76 text-text/84 hover:bg-overlay/94 hidden h-10 w-10 items-center justify-center border-b border-l transition md:inline-flex"
                  onClick={() => setIsInfoPanelOpen((current) => !current)}
                  aria-label={
                    isInfoPanelOpen
                      ? 'Collapse information panel'
                      : 'Expand information panel'
                  }
                >
                  {isInfoPanelOpen ? (
                    <PanelRightClose className="size-5" strokeWidth={1.8} />
                  ) : (
                    <PanelRightOpen className="size-5" strokeWidth={1.8} />
                  )}
                </button>

                <button
                  type="button"
                  className="border-subtle/18 bg-overlay/76 text-text/84 hover:bg-overlay/94 inline-flex h-10 w-10 items-center justify-center border-b border-l transition"
                  onClick={onClose}
                >
                  <span className="sr-only">Close preview</span>
                  <X className="size-5" strokeWidth={1.8} />
                </button>
              </div>

              <PhotoProgressiveView
                photo={currentPhoto}
                className="absolute inset-0"
              />

              <button
                type="button"
                className={cn(
                  'border-subtle/18 bg-overlay/72 text-text/84 hover:bg-overlay/92 absolute top-1/2 left-0 z-40 inline-flex h-12 w-10 -translate-y-1/2 items-center justify-center border-y border-r transition',
                  !canGoPrevious && 'pointer-events-none opacity-30',
                )}
                onClick={() => goTo(activeIndex - 1)}
                aria-label="Previous photo"
              >
                <ChevronLeft className="size-5" strokeWidth={1.8} />
              </button>

              <button
                type="button"
                className={cn(
                  'border-subtle/18 bg-overlay/72 text-text/84 hover:bg-overlay/92 absolute top-1/2 right-0 z-40 inline-flex h-12 w-10 -translate-y-1/2 items-center justify-center border-y border-l transition',
                  !canGoNext && 'pointer-events-none opacity-30',
                )}
                onClick={() => goTo(activeIndex + 1)}
                aria-label="Next photo"
              >
                <ChevronRight className="size-5" strokeWidth={1.8} />
              </button>
            </section>

            {isInfoPanelOpen ? (
              <PhotoViewerInfoPanel photo={currentPhoto} />
            ) : null}
          </div>
        </div>

        <PhotoViewerThumbnailRail
          photos={photos}
          activeIndex={activeIndex}
          hoverPreviewIndex={hoverPreview?.index ?? null}
          loadedThumbnailUrls={loadedThumbnailUrls}
          railShellRef={railShellRef}
          railViewportRef={railViewportRef}
          thumbnailRefs={thumbnailRefs}
          onSelect={goTo}
          onThumbnailEnter={handleThumbnailEnter}
          onThumbnailMove={handleThumbnailMove}
          onThumbnailLeave={handleThumbnailLeave}
          onThumbnailLoad={markThumbnailLoaded}
        />
      </div>
    </div>,
    portalRoot,
  )
}
