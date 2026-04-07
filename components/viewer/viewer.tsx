'use client'

/* eslint-disable @next/next/no-img-element */
import {
  ChevronLeft,
  ChevronRight,
  Info,
  PanelRightClose,
  PanelRightOpen,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useMobile } from '@/hooks/use-mobile'
import type { Photo } from '@/lib/photos'
import { cn } from '@/lib/style'
import { useBodyScrollLock } from './hooks/use-body-scroll-lock'
import { useViewerKeyboardNavigation } from './hooks/use-photo-viewer-keyboard-navigation'
import { LoadingIndicator, type LoadingIndicatorRef } from './loading-indicator'
import { ProgressiveView } from './progressive-view'
import { ThumbnailRail } from './thumbnail-rail'
import { ViewerInfoPanel } from './viewer-info-panel'

const MAX_RENDERED_VIEWS = 3

function normalizeRenderedIndices(
  renderedIndices: number[],
  activeIndex: number,
  photosLength: number,
) {
  return renderedIndices
    .filter(
      (index) => index >= 0 && index < photosLength && index !== activeIndex,
    )
    .concat(activeIndex)
    .slice(-MAX_RENDERED_VIEWS)
}

interface ViewerProps {
  photos: Photo[]
  activeIndex: number
  onClose: () => void
  onChange: (index: number) => void
}

export function Viewer({
  photos,
  activeIndex,
  onClose,
  onChange,
}: ViewerProps) {
  const isMobile = useMobile()
  const [isDesktopInfoPanelOpen, setIsDesktopInfoPanelOpen] = useState(true)
  const [isMobileInfoPanelOpen, setIsMobileInfoPanelOpen] = useState(false)
  const [renderedIndices, setRenderedIndices] = useState<number[]>([
    activeIndex,
  ])
  const loadingIndicatorRef = useRef<LoadingIndicatorRef | null>(null)

  const currentPhoto = photos[activeIndex]
  const canGoPrevious = activeIndex > 0
  const canGoNext = activeIndex < photos.length - 1
  const isInfoPanelOpen = isMobile
    ? isMobileInfoPanelOpen
    : isDesktopInfoPanelOpen

  useBodyScrollLock()

  useEffect(() => {
    const loadingIndicator = loadingIndicatorRef.current

    return () => {
      loadingIndicator?.resetLoadingState()
    }
  }, [])

  const goTo = (index: number) => {
    if (index < 0 || index >= photos.length) {
      return
    }

    setRenderedIndices((current) =>
      normalizeRenderedIndices(current, index, photos.length),
    )
    onChange(index)
  }

  useViewerKeyboardNavigation({
    activeIndex,
    onClose,
    onGoTo: goTo,
  })

  const toggleInfoPanel = () => {
    if (isMobile) {
      setIsMobileInfoPanelOpen((current) => !current)
      return
    }

    setIsDesktopInfoPanelOpen((current) => !current)
  }

  const renderedPhotos = normalizeRenderedIndices(
    renderedIndices,
    activeIndex,
    photos.length,
  )
    .map((index) => ({
      index,
      photo: photos[index],
    }))
    .filter((entry): entry is { index: number; photo: Photo } =>
      Boolean(entry.photo),
    )

  const handleInfoPanelClose = () => {
    if (isMobile) {
      setIsMobileInfoPanelOpen(false)
      return
    }

    setIsDesktopInfoPanelOpen(false)
  }

  return (
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

      <div className="fixed inset-0 flex min-h-0 min-w-0 flex-col lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col">
          <section className="group relative min-h-0 min-w-0 flex-1 overflow-hidden">
            <div className="absolute top-2 right-2 z-50 flex items-start justify-between gap-2">
              <button
                type="button"
                className="bg-overlay/80 hover:bg-overlay/90 hidden h-8 w-8 cursor-pointer items-center justify-center rounded-full duration-200 lg:inline-flex"
                onClick={toggleInfoPanel}
                aria-expanded={isInfoPanelOpen}
                aria-label={
                  isInfoPanelOpen
                    ? 'Collapse information panel'
                    : 'Expand information panel'
                }
              >
                {isInfoPanelOpen ? (
                  <PanelRightClose className="size-4" />
                ) : (
                  <PanelRightOpen className="size-4" />
                )}
              </button>

              <button
                type="button"
                className="bg-overlay/80 hover:bg-overlay/90 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full duration-200 lg:hidden"
                onClick={toggleInfoPanel}
                aria-expanded={isInfoPanelOpen}
                aria-label={
                  isInfoPanelOpen
                    ? 'Collapse information panel'
                    : 'Expand information panel'
                }
              >
                <Info className="size-4" />
              </button>

              <button
                type="button"
                className="bg-overlay/80 hover:bg-overlay/90 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full duration-200"
                onClick={onClose}
                aria-label="Close preview"
              >
                <X className="size-4" />
              </button>
            </div>

            {renderedPhotos.map(({ index, photo }) => {
              const isActive = index === activeIndex

              return (
                <div
                  key={photo.id}
                  className={cn(
                    'absolute inset-0',
                    isActive
                      ? 'z-20 opacity-100'
                      : 'pointer-events-none z-0 opacity-0',
                  )}
                  aria-hidden={!isActive}
                >
                  <ProgressiveView
                    photo={photo}
                    isActive={isActive}
                    className="absolute inset-0"
                    loadingIndicatorRef={loadingIndicatorRef}
                  />
                </div>
              )
            })}

            <LoadingIndicator
              key={currentPhoto.id}
              ref={loadingIndicatorRef}
              ownerId={currentPhoto.id}
            />

            <button
              type="button"
              disabled={!canGoPrevious}
              className={cn(
                'bg-overlay/80 hover:bg-overlay/90 absolute top-1/2 left-4 z-50 hidden h-8 w-8 shrink-0 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full opacity-0 backdrop-blur-sm duration-200 group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-0 lg:inline-flex',
              )}
              onClick={() => goTo(activeIndex - 1)}
              aria-label="Previous photo"
            >
              <ChevronLeft className="size-5" />
            </button>

            <button
              type="button"
              disabled={!canGoNext}
              className={cn(
                'bg-overlay/80 hover:bg-overlay/90 absolute top-1/2 right-4 z-50 hidden h-8 w-8 shrink-0 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full opacity-0 backdrop-blur-sm duration-200 group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-30 lg:inline-flex',
              )}
              onClick={() => goTo(activeIndex + 1)}
              aria-label="Next photo"
            >
              <ChevronRight className="size-5" />
            </button>
          </section>

          <ThumbnailRail
            photos={photos}
            activeIndex={activeIndex}
            onSelect={goTo}
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
