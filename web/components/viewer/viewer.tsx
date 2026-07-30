'use client'

import {
  ChevronLeft,
  ChevronRight,
  Info,
  PanelRightClose,
  PanelRightOpen,
  X,
} from 'lucide-react'
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { useMobile } from '@/hooks/use-mobile'
import type { Photo } from '@/lib/photo'
import { getThumbHashAsset } from '@/lib/thumbhash'
import { useBodyScrollLock } from './hooks/use-body-scroll-lock'
import { useDialogFocus } from './hooks/use-dialog-focus'
import { useViewerKeyboardNavigation } from './hooks/use-viewer-keyboard-navigation'
import { getPhotoAccentColor } from './lib/accent-color'
import { PhotoCarousel } from './photo-carousel'
import { ThumbHashCrossfade } from './thumbhash-crossfade'
import { ThumbnailRail } from './thumbnail-rail'
import { ViewerInfoPanel } from './viewer-info-panel'

interface ViewerProps {
  photos: Photo[]
  activeIndex: number
  onClose: () => void
  onActiveIndexChange: (index: number) => void
}

export function Viewer({
  photos,
  activeIndex,
  onClose,
  onActiveIndexChange,
}: ViewerProps) {
  const isMobile = useMobile()
  const [isDesktopInfoPanelOpen, setIsDesktopInfoPanelOpen] = useState(true)
  const [isMobileInfoPanelOpen, setIsMobileInfoPanelOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const infoButtonRef = useRef<HTMLButtonElement | null>(null)

  const currentPhoto = photos[activeIndex]
  const viewerAccent = useMemo(
    () =>
      getPhotoAccentColor(
        getThumbHashAsset(currentPhoto.thumbHash).averageColor,
      ),
    [currentPhoto.thumbHash],
  )
  const canGoPrevious = activeIndex > 0
  const canGoNext = activeIndex < photos.length - 1
  const isInfoPanelOpen = isMobile
    ? isMobileInfoPanelOpen
    : isDesktopInfoPanelOpen

  useBodyScrollLock()
  useDialogFocus(dialogRef, closeButtonRef)

  const goToPhoto = useCallback(
    (index: number) => {
      if (index < 0 || index >= photos.length) {
        return
      }

      onActiveIndexChange(index)
    },
    [onActiveIndexChange, photos.length],
  )

  useViewerKeyboardNavigation({
    activeIndex,
    onClose,
    onGoTo: goToPhoto,
  })

  const toggleInfoPanel = () => {
    if (isMobile) {
      setIsMobileInfoPanelOpen((current) => !current)
      return
    }

    setIsDesktopInfoPanelOpen((current) => !current)
  }

  const handleInfoPanelClose = () => {
    if (isMobile) {
      setIsMobileInfoPanelOpen(false)
      window.requestAnimationFrame(() => {
        infoButtonRef.current?.focus({ preventScroll: true })
      })
      return
    }

    setIsDesktopInfoPanelOpen(false)
  }

  return (
    <div
      ref={dialogRef}
      className="bg-base motion-safe:animate-viewer-enter fixed inset-0 z-100 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${currentPhoto.title}`}
      tabIndex={-1}
      style={{ '--viewer-accent': viewerAccent } as CSSProperties}
    >
      <ThumbHashCrossfade
        photoId={currentPhoto.id}
        thumbHash={currentPhoto.thumbHash}
        className="bg-base fixed inset-0"
        imageClassName="scale-110"
      />

      <div className="fixed inset-0 flex min-h-0 min-w-0 flex-col lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col">
          <section className="group relative min-h-0 min-w-0 flex-1 overflow-hidden">
            <div className="absolute top-[calc(env(safe-area-inset-top)+0.5rem)] right-[calc(env(safe-area-inset-right)+0.5rem)] z-50 flex items-start justify-between gap-2">
              <button
                ref={infoButtonRef}
                type="button"
                className="circle-button"
                onClick={toggleInfoPanel}
                aria-expanded={isInfoPanelOpen}
                aria-label={
                  isInfoPanelOpen
                    ? 'Collapse information panel'
                    : 'Expand information panel'
                }
              >
                <Info className="size-4 lg:hidden" />
                {isInfoPanelOpen ? (
                  <PanelRightClose className="hidden size-4 lg:block" />
                ) : (
                  <PanelRightOpen className="hidden size-4 lg:block" />
                )}
              </button>

              <button
                ref={closeButtonRef}
                type="button"
                className="circle-button"
                onClick={onClose}
                aria-label="Close preview"
              >
                <X className="size-4" />
              </button>
            </div>

            <PhotoCarousel
              photos={photos}
              activeIndex={activeIndex}
              isMobile={isMobile}
              isSwipeDisabled={isMobileInfoPanelOpen}
              onActiveIndexChange={goToPhoto}
            />

            <button
              type="button"
              disabled={!canGoPrevious}
              className="circle-button absolute top-1/2 left-4 z-50 hidden -translate-y-1/2 opacity-0 group-hover:opacity-100 lg:inline-flex"
              onClick={() => goToPhoto(activeIndex - 1)}
              aria-label="Previous photo"
            >
              <ChevronLeft className="size-5" />
            </button>

            <button
              type="button"
              disabled={!canGoNext}
              className="circle-button absolute top-1/2 right-4 z-50 hidden -translate-y-1/2 opacity-0 group-hover:opacity-100 lg:inline-flex"
              onClick={() => goToPhoto(activeIndex + 1)}
              aria-label="Next photo"
            >
              <ChevronRight className="size-5" />
            </button>
          </section>

          <ThumbnailRail
            photos={photos}
            activeIndex={activeIndex}
            onSelect={goToPhoto}
          />
        </div>

        <ViewerInfoPanel
          photo={currentPhoto}
          isOpen={isInfoPanelOpen}
          onClose={handleInfoPanelClose}
        />
      </div>
    </div>
  )
}
