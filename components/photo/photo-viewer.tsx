'use client'

/* eslint-disable @next/next/no-img-element */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react'
import type { GalleryPhoto } from '@/lib/photos'
import { cn } from '@/lib/utils/style'
import { BlurhashCanvas } from '../blurhash-canvas'
import { formatBytes } from './photo-masonry.utils'
import { PhotoProgressiveView } from './photo-progressive-view'

interface HoverPreviewState {
  index: number
  left: number
  width: number
}

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-5', direction === 'left' ? '' : 'rotate-180')}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  )
}

function PanelIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3.5" y="4.5" width="17" height="15" rx="0" />
      {collapsed ? (
        <path d="M15 8l4 0M15 12l4 0M15 16l4 0" />
      ) : (
        <>
          <path d="M14 4.5v15" />
          <path d="M17 9l-3 3 3 3" />
        </>
      )}
    </svg>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

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
  const [hoverPreview, setHoverPreview] = useState<HoverPreviewState | null>(
    null,
  )
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(true)

  const currentPhoto = photos[activeIndex]
  const canGoPrevious = activeIndex > 0
  const canGoNext = activeIndex < photos.length - 1

  const infoLabel = useMemo(() => {
    return `${currentPhoto.original.width} × ${currentPhoto.original.height} · ${currentPhoto.original.mime.replace('image/', '').toUpperCase()} · ${formatBytes(currentPhoto.original.bytes)}`
  }, [
    currentPhoto.original.bytes,
    currentPhoto.original.height,
    currentPhoto.original.mime,
    currentPhoto.original.width,
  ])

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= photos.length) {
        return
      }

      onChange(index)
    },
    [onChange, photos.length],
  )

  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow
    const previousBodyOverflow = document.body.style.overflow

    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow
      document.body.style.overflow = previousBodyOverflow
    }
  }, [])

  useEffect(() => {
    const currentThumbnail = thumbnailRefs.current[activeIndex]

    currentThumbnail?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [activeIndex])

  useEffect(() => {
    const railViewport = railViewportRef.current

    if (!railViewport) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        return
      }

      event.preventDefault()
      railViewport.scrollLeft += event.deltaY
    }

    railViewport.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      railViewport.removeEventListener('wheel', handleWheel)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goTo(activeIndex - 1)
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goTo(activeIndex + 1)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeIndex, goTo, onClose])

  const updateHoverPreview = useCallback(
    (index: number, button: HTMLButtonElement) => {
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        return
      }

      const railShell = railShellRef.current
      const photo = photos[index]

      if (!railShell || !photo) {
        return
      }

      const shellRect = railShell.getBoundingClientRect()
      const buttonRect = button.getBoundingClientRect()
      const previewHeight = clamp(
        Math.round(window.innerHeight * 0.24),
        180,
        240,
      )
      const previewWidth = clamp(
        Math.round(previewHeight * photo.aspectRatio),
        220,
        Math.max(220, Math.min(460, Math.floor(shellRect.width))),
      )
      const rawLeft =
        buttonRect.left -
        shellRect.left +
        buttonRect.width / 2 -
        previewWidth / 2
      const maxLeft = Math.max(0, shellRect.width - previewWidth)

      setHoverPreview({
        index,
        left: clamp(rawLeft, 0, maxLeft),
        width: previewWidth,
      })
    },
    [photos],
  )

  const handleThumbnailEnter = useCallback(
    (index: number, event: MouseEvent<HTMLButtonElement>) => {
      updateHoverPreview(index, event.currentTarget)
    },
    [updateHoverPreview],
  )

  const handleThumbnailMove = useCallback(
    (index: number, event: MouseEvent<HTMLButtonElement>) => {
      updateHoverPreview(index, event.currentTarget)
    },
    [updateHoverPreview],
  )

  const handleThumbnailLeave = useCallback(() => {
    setHoverPreview(null)
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 [animation:viewer-enter_220ms_cubic-bezier(0.16,1,0.3,1)] overflow-hidden bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${currentPhoto.title}`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/94"
        onClick={onClose}
        aria-label="Close preview"
      />

      <BlurhashCanvas
        hash={currentPhoto.blurhash}
        className="pointer-events-none absolute inset-0 scale-110 opacity-35 blur-3xl"
      />

      <div className="relative flex h-full flex-col">
        <div className="min-h-0 flex-1">
          <div className="flex h-full min-h-0">
            <section className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-black">
              <div className="absolute top-0 right-0 z-40 flex">
                <button
                  type="button"
                  className="hidden h-10 w-10 items-center justify-center border-b border-l border-white/10 bg-black/58 text-white/82 transition hover:bg-black/74 md:inline-flex"
                  onClick={() => setIsInfoPanelOpen((current) => !current)}
                  aria-label={
                    isInfoPanelOpen
                      ? 'Collapse information panel'
                      : 'Expand information panel'
                  }
                >
                  <PanelIcon collapsed={!isInfoPanelOpen} />
                </button>

                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center border-b border-l border-white/10 bg-black/58 text-white/82 transition hover:bg-black/74"
                  onClick={onClose}
                >
                  <span className="sr-only">Close preview</span>
                  <CloseIcon />
                </button>
              </div>

              <PhotoProgressiveView
                photo={currentPhoto}
                className="absolute inset-0"
              />

              <button
                type="button"
                className={cn(
                  'absolute top-1/2 left-0 z-40 inline-flex h-12 w-10 -translate-y-1/2 items-center justify-center border-y border-r border-white/10 bg-black/52 text-white/82 transition hover:bg-black/72',
                  !canGoPrevious && 'pointer-events-none opacity-30',
                )}
                onClick={() => goTo(activeIndex - 1)}
                aria-label="Previous photo"
              >
                <ArrowIcon direction="left" />
              </button>

              <button
                type="button"
                className={cn(
                  'absolute top-1/2 right-0 z-40 inline-flex h-12 w-10 -translate-y-1/2 items-center justify-center border-y border-l border-white/10 bg-black/52 text-white/82 transition hover:bg-black/72',
                  !canGoNext && 'pointer-events-none opacity-30',
                )}
                onClick={() => goTo(activeIndex + 1)}
                aria-label="Next photo"
              >
                <ArrowIcon direction="right" />
              </button>
            </section>

            {isInfoPanelOpen ? (
              <aside className="hidden w-[320px] shrink-0 border-l border-white/10 bg-black/82 md:flex md:flex-col">
                <div className="border-b border-white/10 px-6 py-5">
                  <p className="text-[11px] tracking-[0.18em] text-white/42 uppercase">
                    Original frame
                  </p>
                  <h2 className="mt-3 text-2xl text-white/96">
                    {currentPhoto.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-white/54">
                    {infoLabel}
                  </p>
                </div>

                <div className="flex-1 px-6 py-5">
                  <div className="h-full border border-dashed border-white/8 bg-white/[0.02]" />
                </div>
              </aside>
            ) : null}
          </div>
        </div>

        <div
          ref={railShellRef}
          className="relative h-[72px] shrink-0 border-t border-white/10 bg-black/88 md:h-[84px]"
        >
          {hoverPreview ? (
            <div
              className="pointer-events-none absolute bottom-full z-40 hidden border border-white/10 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.5)] md:block"
              style={{
                left: hoverPreview.left,
                width: hoverPreview.width,
              }}
            >
              <div
                className="relative w-full overflow-hidden"
                style={{
                  aspectRatio: `${photos[hoverPreview.index].thumbnail.width} / ${photos[hoverPreview.index].thumbnail.height}`,
                }}
              >
                <img
                  src={photos[hoverPreview.index].blurDataUrl}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <img
                  src={photos[hoverPreview.index].thumbnail.url}
                  alt={photos[hoverPreview.index].alt}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/72 to-transparent px-4 py-3">
                  <p className="truncate text-sm text-white/96">
                    {photos[hoverPreview.index].title}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div
            ref={railViewportRef}
            className="h-full overflow-x-auto overflow-y-hidden"
            aria-label="Preview thumbnails"
          >
            <div className="flex min-w-max items-end">
              {photos.map((photo, index) => {
                const isActive = index === activeIndex
                const isHovered = hoverPreview?.index === index
                const thumbnailHeight = 84
                const thumbnailWidth = Math.max(
                  72,
                  Math.round(thumbnailHeight * photo.aspectRatio),
                )

                return (
                  <button
                    key={photo.id}
                    ref={(node) => {
                      thumbnailRefs.current[index] = node
                    }}
                    type="button"
                    className={cn(
                      'group relative shrink-0 overflow-hidden transition-[filter,transform,opacity] duration-300 ease-out focus-visible:outline-none',
                      isActive
                        ? 'z-10 grayscale-0'
                        : isHovered
                          ? 'grayscale-0'
                          : 'grayscale',
                    )}
                    style={{
                      width: `${thumbnailWidth}px`,
                      height: `${thumbnailHeight}px`,
                    }}
                    onClick={() => goTo(index)}
                    onMouseEnter={(event) => handleThumbnailEnter(index, event)}
                    onMouseMove={(event) => handleThumbnailMove(index, event)}
                    onMouseLeave={handleThumbnailLeave}
                    aria-label={`Open ${photo.title}`}
                  >
                    <img
                      src={photo.blurDataUrl}
                      alt=""
                      aria-hidden
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <img
                      src={photo.thumbnail.url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div
                      className={cn(
                        'absolute inset-0 transition duration-300',
                        isHovered || isActive
                          ? 'bg-transparent'
                          : 'bg-black/26',
                        isActive ? 'ring-1 ring-white/90 ring-inset' : '',
                      )}
                    />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
