'use client'

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GalleryPhoto } from '@/lib/photos'
import { cn } from '@/lib/utils/style'
import { BlurhashCanvas } from '../blurhash-canvas'

type LoadedAssetKind = 'original' | 'thumbnail' | null

interface ImageState {
  photoId: string
  source: string | null
  kind: LoadedAssetKind
  failed: boolean
}

function preloadImage(source: string) {
  return new Promise<void>((resolve, reject) => {
    const image = new window.Image()

    image.decoding = 'async'
    image.onload = () => resolve()
    image.onerror = () => reject(new Error(`Failed to load image: ${source}`))
    image.src = source
  })
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

interface PhotoLightboxProps {
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
}: PhotoLightboxProps) {
  const [imageState, setImageState] = useState<ImageState>({
    photoId: '',
    source: null,
    kind: null,
    failed: false,
  })
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([])

  const currentPhoto = photos[activeIndex]
  const canGoPrevious = activeIndex > 0
  const canGoNext = activeIndex < photos.length - 1
  const isCurrentImageResolved = imageState.photoId === currentPhoto.id
  const loadedSource = isCurrentImageResolved ? imageState.source : null
  const loadedKind = isCurrentImageResolved ? imageState.kind : null
  const hasLoadFailure = isCurrentImageResolved && imageState.failed
  const isLoading = !isCurrentImageResolved

  const metaLabel = useMemo(() => {
    return `${currentPhoto.original.width} × ${currentPhoto.original.height} · ${currentPhoto.original.mime.replace('image/', '').toUpperCase()}`
  }, [
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
    let cancelled = false

    const candidates = [
      { kind: 'original' as const, src: currentPhoto.original.url },
      { kind: 'thumbnail' as const, src: currentPhoto.thumbnail.url },
    ]

    async function loadCurrentPhoto() {
      for (const candidate of candidates) {
        try {
          await preloadImage(candidate.src)

          if (!cancelled) {
            setImageState({
              photoId: currentPhoto.id,
              source: candidate.src,
              kind: candidate.kind,
              failed: false,
            })
          }

          return
        } catch {}
      }

      if (!cancelled) {
        setImageState({
          photoId: currentPhoto.id,
          source: null,
          kind: null,
          failed: true,
        })
      }
    }

    void loadCurrentPhoto()

    return () => {
      cancelled = true
    }
  }, [currentPhoto.id, currentPhoto.original.url, currentPhoto.thumbnail.url])

  useEffect(() => {
    const preloadNeighbor = async (index: number) => {
      const photo = photos[index]

      if (!photo) {
        return
      }

      try {
        await preloadImage(photo.original.url)
      } catch {
        await preloadImage(photo.thumbnail.url).catch(() => undefined)
      }
    }

    void preloadNeighbor(activeIndex - 1)
    void preloadNeighbor(activeIndex + 1)
  }, [activeIndex, photos])

  useEffect(() => {
    const currentThumbnail = thumbnailRefs.current[activeIndex]

    currentThumbnail?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [activeIndex])

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

  return (
    <div
      className="fixed inset-0 z-50 [animation:viewer-enter_220ms_cubic-bezier(0.16,1,0.3,1)] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${currentPhoto.title}`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/82 backdrop-blur-2xl"
        onClick={onClose}
        aria-label="Close preview"
      />

      <BlurhashCanvas
        hash={currentPhoto.blurhash}
        className="pointer-events-none absolute inset-0 scale-110 opacity-35 blur-3xl"
      />

      <div className="relative flex h-full flex-col px-3 py-3 md:px-6 md:py-5">
        <header className="mb-3 flex items-start justify-between gap-3 md:mb-5">
          <div className="min-w-0">
            <p className="font-serif text-3xl tracking-[0.08em] text-white/96 md:text-4xl">
              {currentPhoto.title}
            </p>
            <p className="mt-1 text-sm text-white/58">{metaLabel}</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-sm text-white/70">
              {activeIndex + 1} / {photos.length}
            </div>
            {loadedKind === 'thumbnail' ? (
              <div className="rounded-full border border-amber-200/20 bg-amber-300/12 px-3 py-1.5 text-sm text-amber-100/90">
                Fallback preview
              </div>
            ) : null}
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white transition hover:bg-white/14"
              onClick={onClose}
            >
              <span className="sr-only">Close preview</span>
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <div className="relative flex h-full items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-[0_28px_120px_rgba(0,0,0,0.45)]">
            <BlurhashCanvas
              hash={currentPhoto.blurhash}
              className="absolute inset-0 scale-110 blur-2xl"
            />

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_62%)]" />

            {loadedSource ? (
              <img
                key={loadedSource}
                src={loadedSource}
                alt={currentPhoto.alt}
                className="relative z-10 max-h-full max-w-full [animation:gallery-reveal_380ms_cubic-bezier(0.16,1,0.3,1)] object-contain"
                draggable={false}
              />
            ) : null}

            {isLoading ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center">
                <div className="rounded-full border border-white/12 bg-black/18 px-4 py-2 text-sm tracking-[0.16em] text-white/72 uppercase">
                  Loading frame
                </div>
              </div>
            ) : null}

            {!isLoading && hasLoadFailure ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center">
                <div className="rounded-[1.5rem] border border-white/12 bg-black/20 px-6 py-4 text-center text-sm text-white/68">
                  This frame could not be loaded.
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className={cn(
              'absolute top-1/2 left-3 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-black/26 text-white transition hover:bg-black/38 md:left-5',
              !canGoPrevious && 'pointer-events-none opacity-40',
            )}
            onClick={() => goTo(activeIndex - 1)}
            aria-label="Previous photo"
          >
            <ArrowIcon direction="left" />
          </button>

          <button
            type="button"
            className={cn(
              'absolute top-1/2 right-3 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-black/26 text-white transition hover:bg-black/38 md:right-5',
              !canGoNext && 'pointer-events-none opacity-40',
            )}
            onClick={() => goTo(activeIndex + 1)}
            aria-label="Next photo"
          >
            <ArrowIcon direction="right" />
          </button>
        </div>

        <div className="mt-3 rounded-[1.5rem] border border-white/10 bg-black/18 p-2 md:mt-5 md:p-3">
          <div
            className="overflow-x-auto [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]"
            aria-label="Preview thumbnails"
          >
            <div className="flex min-w-max gap-2">
              {photos.map((photo, index) => {
                const isActive = index === activeIndex

                return (
                  <button
                    key={photo.id}
                    ref={(node) => {
                      thumbnailRefs.current[index] = node
                    }}
                    type="button"
                    className={cn(
                      'group relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border transition md:h-20 md:w-20',
                      isActive
                        ? 'border-white/70 shadow-[0_0_0_1px_rgba(255,255,255,0.1)]'
                        : 'border-white/10 opacity-75 hover:opacity-100',
                    )}
                    onClick={() => goTo(index)}
                    aria-label={`Open ${photo.title}`}
                  >
                    <BlurhashCanvas
                      hash={photo.blurhash}
                      className="absolute inset-0 scale-125 blur-xl"
                    />
                    <img
                      src={photo.thumbnail.url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div
                      className={cn(
                        'absolute inset-0 bg-black/10 transition',
                        isActive ? 'bg-transparent' : 'group-hover:bg-black/0',
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
