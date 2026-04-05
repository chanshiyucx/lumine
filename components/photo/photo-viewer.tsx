'use client'

/* eslint-disable @next/next/no-img-element */
import {
  Aperture,
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  Clock3,
  Crosshair,
  PanelRightClose,
  PanelRightOpen,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react'
import { createPortal } from 'react-dom'
import type { GalleryPhoto } from '@/lib/photos'
import { cn } from '@/lib/utils/style'
import { BlurhashCanvas } from '../blurhash-canvas'
import { formatBytes, formatMimeLabel } from './photo-masonry.utils'
import { PhotoProgressiveView } from './photo-progressive-view'

interface HoverPreviewState {
  index: number
  left: number
  top: number
  width: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function formatSentenceCase(value: string | undefined | null) {
  if (!value) {
    return 'Not available'
  }

  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatDateTimeLabel(takenAt: string | null) {
  if (!takenAt) {
    return 'Not available'
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(takenAt)

  if (!match) {
    return takenAt
  }

  const [, year, month, day, hour, minute, second] = match

  return `${year}/${Number(month)}/${Number(day)} ${hour}:${minute}:${second}`
}

function formatTimeZoneLabel(takenAt: string | null) {
  if (!takenAt) {
    return 'Not available'
  }

  const match = /(Z|[+-]\d{2}:\d{2})$/.exec(takenAt)

  if (!match) {
    return 'Not available'
  }

  if (match[1] === 'Z') {
    return 'UTC'
  }

  const [hours, minutes] = match[1].slice(1).split(':')
  const sign = match[1][0]
  const normalizedHours = String(Number(hours))

  if (minutes === '00') {
    return `UTC${sign}${normalizedHours}`
  }

  return `UTC${sign}${normalizedHours}:${minutes}`
}

function formatMegapixels(width: number, height: number) {
  const megapixels = (width * height) / 1_000_000

  if (megapixels >= 10) {
    return `${Math.floor(megapixels)} MP`
  }

  return `${megapixels.toFixed(1)} MP`
}

function formatFocalLength(value: number | undefined) {
  if (!value) {
    return 'Not available'
  }

  return `${Number(value.toFixed(1)).toString()} mm`
}

function formatApertureValue(value: number | undefined) {
  if (!value) {
    return 'Not available'
  }

  return `f/${Number(value.toFixed(1)).toString()}`
}

function formatIsoValue(value: number | undefined) {
  if (!value) {
    return 'Not available'
  }

  return `ISO ${value}`
}

function formatBrightnessValue(value: number | undefined) {
  if (value === undefined) {
    return 'Not available'
  }

  const normalized = Number(value.toFixed(2))
  const prefix = normalized > 0 ? '+' : ''

  return `${prefix}${normalized} EV`
}

interface InfoRowProps {
  label: string
  value: string
  missing?: boolean
}

function InfoRow({ label, value, missing = false }: InfoRowProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 py-1.5">
      <dt className="text-[13px] leading-5 text-white/42">{label}</dt>
      <dd
        className={cn(
          'text-right text-[13px] leading-5 text-white/92',
          missing && 'text-white/36',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

interface InfoSectionProps {
  title: string
  children: React.ReactNode
}

function InfoSection({ title, children }: InfoSectionProps) {
  return (
    <section className="border-b border-white/8 py-4 last:border-b-0">
      <h3 className="text-[11px] tracking-[0.18em] text-white/42 uppercase">
        {title}
      </h3>
      <dl className="mt-2 divide-y divide-white/6">{children}</dl>
    </section>
  )
}

interface ParameterChipProps {
  icon: LucideIcon
  label: string
  value: string
}

function ParameterChip({ icon: Icon, label, value }: ParameterChipProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="flex items-center gap-2 text-white/56">
        <Icon className="size-3.5" strokeWidth={1.8} />
        <span className="text-[11px] tracking-[0.12em] uppercase">{label}</span>
      </div>
      <p className="mt-1.5 text-sm text-white/94">{value}</p>
    </div>
  )
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
  const [loadedThumbnailUrls, setLoadedThumbnailUrls] = useState<Set<string>>(
    () => new Set(),
  )

  const currentPhoto = photos[activeIndex]
  const canGoPrevious = activeIndex > 0
  const canGoNext = activeIndex < photos.length - 1
  const hoverPreviewPhoto = hoverPreview ? photos[hoverPreview.index] : null
  const isHoverPreviewImageLoaded = hoverPreviewPhoto
    ? loadedThumbnailUrls.has(hoverPreviewPhoto.thumbnail.url)
    : false
  const primarySettings = useMemo(() => {
    return [
      {
        icon: Crosshair,
        label: 'Focal',
        value: formatFocalLength(
          currentPhoto.camera?.focalLengthIn35mm ??
            currentPhoto.camera?.focalLengthMm,
        ),
      },
      {
        icon: Aperture,
        label: 'Aperture',
        value: formatApertureValue(currentPhoto.camera?.aperture),
      },
      {
        icon: Clock3,
        label: 'Shutter',
        value: currentPhoto.camera?.shutter ?? 'Not available',
      },
      {
        icon: CircleGauge,
        label: 'ISO',
        value: formatIsoValue(currentPhoto.camera?.iso),
      },
    ]
  }, [currentPhoto.camera])
  const fileInfoRows = useMemo(() => {
    return [
      { label: 'File Name', value: currentPhoto.fileName },
      { label: 'Format', value: formatMimeLabel(currentPhoto) },
      {
        label: 'Dimensions',
        value: `${currentPhoto.original.width} × ${currentPhoto.original.height}`,
      },
      { label: 'File Size', value: formatBytes(currentPhoto.original.bytes) },
      {
        label: 'Megapixels',
        value: formatMegapixels(
          currentPhoto.original.width,
          currentPhoto.original.height,
        ),
      },
      {
        label: 'Color Space',
        value: currentPhoto.image?.colorSpace ?? 'Not available',
        missing: !currentPhoto.image?.colorSpace,
      },
      {
        label: 'Location',
        value: currentPhoto.locationLabel,
        missing: currentPhoto.locationLabel === 'Not available',
      },
      { label: 'Taken At', value: formatDateTimeLabel(currentPhoto.takenAt) },
      { label: 'Time Zone', value: formatTimeZoneLabel(currentPhoto.takenAt) },
    ]
  }, [currentPhoto])
  const deviceInfoRows = useMemo(() => {
    return [
      {
        label: 'Camera',
        value:
          [currentPhoto.camera?.make, currentPhoto.camera?.model]
            .filter(Boolean)
            .join(' ') || 'Not available',
        missing: !currentPhoto.camera?.make && !currentPhoto.camera?.model,
      },
      {
        label: 'Lens',
        value: currentPhoto.camera?.lens ?? 'Not available',
        missing: !currentPhoto.camera?.lens,
      },
      {
        label: 'Focal Length',
        value: formatFocalLength(currentPhoto.camera?.focalLengthMm),
        missing: !currentPhoto.camera?.focalLengthMm,
      },
      {
        label: '35mm Equivalent',
        value: formatFocalLength(currentPhoto.camera?.focalLengthIn35mm),
        missing: !currentPhoto.camera?.focalLengthIn35mm,
      },
      {
        label: 'Max Aperture',
        value: formatApertureValue(currentPhoto.camera?.maxAperture),
        missing: !currentPhoto.camera?.maxAperture,
      },
    ]
  }, [currentPhoto.camera])
  const exposureRows = useMemo(() => {
    return [
      {
        label: 'Exposure Program',
        value: formatSentenceCase(currentPhoto.camera?.exposureProgram),
        missing: !currentPhoto.camera?.exposureProgram,
      },
      {
        label: 'Exposure Mode',
        value: formatSentenceCase(currentPhoto.camera?.exposureMode),
        missing: !currentPhoto.camera?.exposureMode,
      },
      {
        label: 'Metering Mode',
        value: formatSentenceCase(currentPhoto.camera?.meteringMode),
        missing: !currentPhoto.camera?.meteringMode,
      },
      {
        label: 'White Balance',
        value: formatSentenceCase(currentPhoto.camera?.whiteBalance),
        missing: !currentPhoto.camera?.whiteBalance,
      },
      {
        label: 'Flash',
        value: formatSentenceCase(currentPhoto.camera?.flash),
        missing: !currentPhoto.camera?.flash,
      },
      {
        label: 'Light Source',
        value: formatSentenceCase(currentPhoto.camera?.lightSource),
        missing: !currentPhoto.camera?.lightSource,
      },
      {
        label: 'Scene Capture Type',
        value: formatSentenceCase(currentPhoto.camera?.sceneCaptureType),
        missing: !currentPhoto.camera?.sceneCaptureType,
      },
      {
        label: 'Brightness',
        value: formatBrightnessValue(currentPhoto.camera?.brightnessEv),
        missing: currentPhoto.camera?.brightnessEv === undefined,
      },
    ]
  }, [currentPhoto.camera])
  const missingMetadataFields = useMemo(() => {
    const missing: string[] = []

    if (!currentPhoto.camera?.lightSource) {
      missing.push('Light Source')
    }

    return missing
  }, [currentPhoto.camera])

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
      const rawLeft = buttonRect.left + buttonRect.width / 2 - previewWidth / 2
      const maxLeft = Math.max(12, window.innerWidth - previewWidth - 12)
      const previewTop = Math.max(12, shellRect.top - previewHeight)

      setHoverPreview({
        index,
        left: clamp(rawLeft, 12, maxLeft),
        top: previewTop,
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

  if (!portalRoot) {
    return null
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80] [animation:viewer-enter_220ms_cubic-bezier(0.16,1,0.3,1)] overflow-hidden bg-black"
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

      {hoverPreview && hoverPreviewPhoto ? (
        <div
          className="pointer-events-none absolute z-[90] hidden origin-bottom overflow-hidden bg-black shadow-[0_24px_80px_rgba(0,0,0,0.48)] motion-safe:[animation:viewer-hover-preview_220ms_cubic-bezier(0.16,1,0.3,1)_both] md:block"
          style={{
            left: hoverPreview.left,
            top: hoverPreview.top,
            width: hoverPreview.width,
          }}
        >
          <div
            className="relative w-full overflow-hidden"
            style={{
              aspectRatio: `${hoverPreviewPhoto.thumbnail.width} / ${hoverPreviewPhoto.thumbnail.height}`,
            }}
          >
            {!isHoverPreviewImageLoaded ? (
              <img
                src={hoverPreviewPhoto.blurDataUrl}
                alt=""
                aria-hidden
                className="absolute inset-0 h-full w-full scale-[1.04] object-cover blur-sm"
              />
            ) : null}
            <img
              src={hoverPreviewPhoto.thumbnail.url}
              alt={hoverPreviewPhoto.alt}
              className={cn(
                'absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ease-out',
                isHoverPreviewImageLoaded ? 'opacity-100' : 'opacity-0',
              )}
              draggable={false}
              onLoad={() =>
                markThumbnailLoaded(hoverPreviewPhoto.thumbnail.url)
              }
            />
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/72 to-transparent px-4 py-3">
              <p className="truncate text-sm text-white/96">
                {hoverPreviewPhoto.title}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="absolute inset-0 flex min-h-0 min-w-0 flex-col">
        <div className="flex min-h-0 min-w-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1">
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
                  {isInfoPanelOpen ? (
                    <PanelRightClose className="size-5" strokeWidth={1.8} />
                  ) : (
                    <PanelRightOpen className="size-5" strokeWidth={1.8} />
                  )}
                </button>

                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center border-b border-l border-white/10 bg-black/58 text-white/82 transition hover:bg-black/74"
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
                  'absolute top-1/2 left-0 z-40 inline-flex h-12 w-10 -translate-y-1/2 items-center justify-center border-y border-r border-white/10 bg-black/52 text-white/82 transition hover:bg-black/72',
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
                  'absolute top-1/2 right-0 z-40 inline-flex h-12 w-10 -translate-y-1/2 items-center justify-center border-y border-l border-white/10 bg-black/52 text-white/82 transition hover:bg-black/72',
                  !canGoNext && 'pointer-events-none opacity-30',
                )}
                onClick={() => goTo(activeIndex + 1)}
                aria-label="Next photo"
              >
                <ChevronRight className="size-5" strokeWidth={1.8} />
              </button>
            </section>

            {isInfoPanelOpen ? (
              <aside className="hidden w-[360px] shrink-0 overflow-y-auto border-l border-white/10 bg-black/82 md:flex md:flex-col">
                <div className="px-6 py-2">
                  <InfoSection title="Photo Info">
                    {fileInfoRows.map((row) => (
                      <InfoRow
                        key={row.label}
                        label={row.label}
                        value={row.value}
                        missing={row.missing}
                      />
                    ))}
                  </InfoSection>

                  <section className="border-b border-white/8 py-5">
                    <h3 className="text-[11px] tracking-[0.18em] text-white/42 uppercase">
                      Capture Settings
                    </h3>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      {primarySettings.map((setting) => (
                        <ParameterChip
                          key={setting.label}
                          icon={setting.icon}
                          label={setting.label}
                          value={setting.value}
                        />
                      ))}
                    </div>
                  </section>

                  <InfoSection title="Device Info">
                    {deviceInfoRows.map((row) => (
                      <InfoRow
                        key={row.label}
                        label={row.label}
                        value={row.value}
                        missing={row.missing}
                      />
                    ))}
                  </InfoSection>

                  <InfoSection title="Exposure">
                    {exposureRows.map((row) => (
                      <InfoRow
                        key={row.label}
                        label={row.label}
                        value={row.value}
                        missing={row.missing}
                      />
                    ))}
                  </InfoSection>

                  {missingMetadataFields.length > 0 ? (
                    <div className="my-4 rounded-xl border border-amber-200/12 bg-amber-300/6 px-4 py-3">
                      <div className="flex items-start gap-3">
                        <Camera
                          className="mt-0.5 size-4 shrink-0 text-amber-100/70"
                          strokeWidth={1.8}
                        />
                        <div>
                          <p className="text-xs tracking-[0.16em] text-amber-100/72 uppercase">
                            Missing Metadata
                          </p>
                          <p className="mt-1 text-sm leading-5 text-amber-50/86">
                            {missingMetadataFields.join(', ')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </aside>
            ) : null}
          </div>
        </div>

        <div
          ref={railShellRef}
          className="relative h-[72px] w-full shrink-0 bg-black/86 backdrop-blur-xl md:h-[84px]"
        >
          <div
            ref={railViewportRef}
            className="h-full overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                const isThumbnailLoaded = loadedThumbnailUrls.has(
                  photo.thumbnail.url,
                )

                return (
                  <button
                    key={photo.id}
                    ref={(node) => {
                      thumbnailRefs.current[index] = node
                    }}
                    type="button"
                    className={cn(
                      'group relative shrink-0 overflow-hidden transition-[filter,opacity] duration-300 ease-out focus:outline-none focus-visible:outline-none',
                      isActive
                        ? 'z-10 opacity-100 grayscale-0'
                        : isHovered
                          ? 'opacity-100 grayscale-0'
                          : 'opacity-72 grayscale hover:opacity-92',
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
                    aria-current={isActive}
                  >
                    {!isThumbnailLoaded ? (
                      <img
                        src={photo.blurDataUrl}
                        alt=""
                        aria-hidden
                        className="absolute inset-0 h-full w-full scale-[1.04] object-cover blur-[2px]"
                      />
                    ) : null}
                    <img
                      src={photo.thumbnail.url}
                      alt=""
                      className={cn(
                        'absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ease-out',
                        isThumbnailLoaded ? 'opacity-100' : 'opacity-0',
                      )}
                      loading="lazy"
                      draggable={false}
                      onLoad={() => markThumbnailLoaded(photo.thumbnail.url)}
                    />
                    <div
                      className={cn(
                        'absolute inset-0 transition-colors duration-200',
                        isHovered || isActive
                          ? 'bg-transparent'
                          : 'bg-black/26',
                      )}
                    />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>,
    portalRoot,
  )
}
