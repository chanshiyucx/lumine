'use client'

/* eslint-disable @next/next/no-img-element */
import { LoaderCircle } from 'lucide-react'
import { WebGLImageViewer } from '@/components/webgl-viewer'
import type { GalleryPhoto } from '@/lib/photos'
import { cn } from '@/lib/style'
import { useProgressivePhoto } from './hooks/use-progressive-photo'
import { formatBytes } from './lib/formatters'

interface PhotoProgressiveViewProps {
  photo: GalleryPhoto
  className?: string
}

export function PhotoProgressiveView({
  photo,
  className,
}: PhotoProgressiveViewProps) {
  const { state, isThumbnailLoaded, handleThumbnailLoad } =
    useProgressivePhoto(photo)

  const progressLabel =
    state.totalBytes && state.totalBytes > 0
      ? `${Math.round(state.progress ?? 0)}%`
      : 'Streaming'

  const bytesLabel =
    state.totalBytes && state.totalBytes > 0
      ? `${formatBytes(state.loadedBytes)} / ${formatBytes(state.totalBytes)}`
      : formatBytes(state.loadedBytes)

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      <img
        src={photo.blurDataUrl}
        alt=""
        aria-hidden
        className="absolute inset-0 scale-110 opacity-90 blur-2xl"
      />

      <img
        src={photo.thumbnail.url}
        alt=""
        aria-hidden
        className={cn(
          'absolute inset-0 h-full w-full object-contain transition-opacity duration-300',
          isThumbnailLoaded ? 'opacity-100' : 'opacity-0',
          state.mode === 'thumbnail' ? 'z-10' : 'opacity-75 saturate-80',
        )}
        loading="eager"
        onLoad={handleThumbnailLoad}
      />

      {state.mode === 'webgl' && state.renderSource ? (
        <div className="absolute inset-0 z-20">
          <WebGLImageViewer
            src={state.renderSource}
            width={photo.original.width}
            height={photo.original.height}
            className="h-full w-full"
            initialScale={1}
            minScale={1}
            maxScale={20}
            limitToBounds={true}
            centerOnInit={true}
            smooth={true}
          />
        </div>
      ) : null}

      {state.mode === 'image' && state.renderSource ? (
        <img
          src={state.renderSource}
          alt={photo.alt}
          className="absolute inset-0 z-20 h-full w-full object-contain"
          draggable={false}
        />
      ) : null}

      {state.mode === 'loading' ? (
        <div className="pointer-events-none absolute right-4 bottom-4 z-30 md:right-5 md:bottom-5">
          <div className="border-subtle/18 bg-overlay/82 flex items-center gap-3 rounded-xl border px-3 py-2 backdrop-blur-xl">
            <LoaderCircle
              className="text-foam/86 size-4 animate-spin"
              strokeWidth={1.8}
            />
            <div className="min-w-[88px]">
              <p className="text-text text-xs font-medium tabular-nums">
                {progressLabel}
              </p>
              <p className="text-muted/84 mt-0.5 text-[11px] tabular-nums">
                {bytesLabel}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {state.mode === 'thumbnail' ? (
        <div className="border-gold/18 bg-gold/10 text-gold/92 pointer-events-none absolute top-4 right-4 z-30 rounded-full border px-3 py-1 text-[11px] tracking-[0.16em] uppercase">
          Thumbnail fallback
        </div>
      ) : null}

      {state.mode === 'error' ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <div className="border-subtle/18 bg-overlay/54 text-text/74 rounded-[1.5rem] border px-6 py-4 text-center text-sm">
            This frame could not be loaded.
          </div>
        </div>
      ) : null}
    </div>
  )
}
