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
import { useCallback, useState } from 'react'
import type { GalleryPhoto } from '@/lib/photos'
import { cn } from '@/lib/style'
import { useBodyScrollLock } from './hooks/use-body-scroll-lock'
import { useMobile } from './hooks/use-mobile'
import { useViewerKeyboardNavigation } from './hooks/use-photo-viewer-keyboard-navigation'
import { ProgressiveView } from './progressive-view'
import { ThumbnailRail } from './thumbnail-rail'
import { ViewerInfoPanel } from './viewer-info-panel'

interface ViewerProps {
  photos: GalleryPhoto[]
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

  useViewerKeyboardNavigation({
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
              >
                <span className="sr-only">Close preview</span>
                <X className="size-4" />
              </button>
            </div>

            <ProgressiveView
              photo={currentPhoto}
              className="absolute inset-0"
            />

            <button
              type="button"
              className={cn(
                'bg-overlay/80 hover:bg-overlay/90 absolute top-1/2 left-4 z-50 hidden h-8 w-8 shrink-0 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full opacity-0 backdrop-blur-sm duration-200 group-hover:opacity-100 lg:inline-flex',
                !canGoPrevious && 'pointer-events-none opacity-0',
              )}
              onClick={() => goTo(activeIndex - 1)}
              aria-label="Previous photo"
            >
              <ChevronLeft className="size-5" />
            </button>

            <button
              type="button"
              className={cn(
                'bg-overlay/80 hover:bg-overlay/90 absolute top-1/2 right-4 z-50 hidden h-8 w-8 shrink-0 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full opacity-0 backdrop-blur-sm duration-200 group-hover:opacity-100 lg:inline-flex',
                !canGoNext && 'pointer-events-none opacity-30',
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
          onClose={() => {
            if (isMobile) {
              setIsMobileInfoPanelOpen(false)
              return
            }

            setIsDesktopInfoPanelOpen(false)
          }}
        />
      </div>
    </div>
  )
}
