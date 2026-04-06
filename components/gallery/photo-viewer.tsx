'use client'

/* eslint-disable @next/next/no-img-element */
import {
  ChevronLeft,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  X,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GalleryPhoto } from '@/lib/photos'
import { cn } from '@/lib/style'
import { useBodyScrollLock } from './hooks/use-body-scroll-lock'
import { useMobile } from './hooks/use-mobile'
import { usePhotoViewerKeyboardNavigation } from './hooks/use-photo-viewer-keyboard-navigation'
import { PhotoProgressiveView } from './photo-progressive-view'
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
  const isMobile = useMobile()
  const [isDesktopInfoPanelOpen, setIsDesktopInfoPanelOpen] = useState(true)
  const [isMobileInfoPanelOpen, setIsMobileInfoPanelOpen] = useState(false)

  const currentPhoto = photos[activeIndex]
  const canGoPrevious = activeIndex > 0
  const canGoNext = activeIndex < photos.length - 1
  const isInfoPanelOpen = isMobile
    ? isMobileInfoPanelOpen
    : isDesktopInfoPanelOpen

  useBodyScrollLock()

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

  const toggleInfoPanel = useCallback(() => {
    if (isMobile) {
      setIsMobileInfoPanelOpen((current) => !current)
      return
    }

    setIsDesktopInfoPanelOpen((current) => !current)
  }, [isMobile])

  const portalRoot = typeof document === 'undefined' ? null : document.body

  if (!portalRoot) {
    return null
  }

  return createPortal(
    <div
      className="bg-base motion-safe:animate-viewer-enter fixed inset-0 z-100 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${currentPhoto.title}`}
    >
      <div className="fixed inset-0">
        <img
          src={currentPhoto.blurDataUrl}
          alt=""
          aria-hidden
          className="size-fill h-full w-full scale-110"
        />
      </div>

      <div className="fixed inset-0 flex flex-col">
        <div className="flex min-h-0 min-w-0 flex-1">
          <section className="bg-base relative min-h-0 min-w-0 flex-1 overflow-hidden">
            <div className="absolute top-2 right-2 left-2 z-40 flex items-start justify-between lg:top-0 lg:right-0 lg:left-auto lg:justify-end">
              <button
                type="button"
                className={cn(
                  'border-subtle/18 bg-overlay/76 text-text/84 hover:bg-overlay/94 inline-flex h-10 items-center justify-center border px-3 transition lg:hidden',
                  isInfoPanelOpen && 'bg-overlay',
                )}
                onClick={toggleInfoPanel}
                aria-label={
                  isInfoPanelOpen
                    ? 'Collapse information panel'
                    : 'Expand information panel'
                }
              >
                {isInfoPanelOpen ? 'Hide Info' : 'Show Info'}
              </button>

              <div className="ml-auto flex">
                <button
                  type="button"
                  className="border-subtle/18 bg-overlay/76 text-text/84 hover:bg-overlay/94 hidden h-10 w-10 items-center justify-center border-b border-l transition lg:inline-flex"
                  onClick={toggleInfoPanel}
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
            </div>

            <PhotoProgressiveView
              photo={currentPhoto}
              className="absolute inset-0"
            />

            <button
              type="button"
              className={cn(
                'border-subtle/18 bg-overlay/72 text-text/84 hover:bg-overlay/92 absolute top-1/2 left-0 z-40 hidden h-12 w-10 -translate-y-1/2 items-center justify-center border-y border-r transition lg:inline-flex',
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
                'border-subtle/18 bg-overlay/72 text-text/84 hover:bg-overlay/92 absolute top-1/2 right-0 z-40 hidden h-12 w-10 -translate-y-1/2 items-center justify-center border-y border-l transition lg:inline-flex',
                !canGoNext && 'pointer-events-none opacity-30',
              )}
              onClick={() => goTo(activeIndex + 1)}
              aria-label="Next photo"
            >
              <ChevronRight className="size-5" strokeWidth={1.8} />
            </button>
          </section>

          {!isMobile && isInfoPanelOpen && (
            <PhotoViewerInfoPanel photo={currentPhoto} />
          )}
        </div>

        {isMobile && isInfoPanelOpen && (
          <PhotoViewerInfoPanel
            photo={currentPhoto}
            isMobile={true}
            onClose={() => setIsMobileInfoPanelOpen(false)}
          />
        )}

        <PhotoViewerThumbnailRail
          photos={photos}
          activeIndex={activeIndex}
          onSelect={goTo}
        />
      </div>
    </div>,
    portalRoot,
  )
}
