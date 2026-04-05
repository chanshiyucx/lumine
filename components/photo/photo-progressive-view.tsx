'use client'

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react'
import type { GalleryPhoto } from '@/lib/photos'
import { cn } from '@/lib/utils/style'
import { BlurhashCanvas } from '../blurhash-canvas'
import { formatBytes } from './photo-masonry.utils'
import { WebGLImageViewer } from './webgl-viewer'

type RenderMode = 'loading' | 'webgl' | 'image' | 'thumbnail' | 'error'

interface ProgressiveState {
  photoId: string
  mode: RenderMode
  loadedBytes: number
  totalBytes: number | null
  progress: number | null
  renderSource: string | null
}

interface PhotoProgressiveViewProps {
  photo: GalleryPhoto
  className?: string
}

function supportsWebGL() {
  const canvas = document.createElement('canvas')

  return Boolean(canvas.getContext('webgl'))
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

async function readResponseAsBlob(
  response: Response,
  signal: AbortSignal,
  mimeType: string,
  onProgress: (loadedBytes: number) => void,
) {
  if (!response.body) {
    const blob = await response.blob()
    onProgress(blob.size)
    return blob
  }

  const reader = response.body.getReader()
  const chunks: ArrayBuffer[] = []
  let loadedBytes = 0

  while (true) {
    if (signal.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError')
    }

    const { done, value } = await reader.read()

    if (done) {
      break
    }

    if (!value) {
      continue
    }

    const chunk = Uint8Array.from(value)
    chunks.push(chunk.buffer)
    loadedBytes += value.byteLength
    onProgress(loadedBytes)
  }

  return new Blob(chunks, {
    type: response.headers.get('content-type') ?? mimeType,
  })
}

export function PhotoProgressiveView({
  photo,
  className,
}: PhotoProgressiveViewProps) {
  const [isThumbnailLoaded, setIsThumbnailLoaded] = useState(false)
  const [state, setState] = useState<ProgressiveState>({
    photoId: photo.id,
    mode: 'loading',
    loadedBytes: 0,
    totalBytes: photo.original.bytes,
    progress: 0,
    renderSource: null,
  })
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    const releaseResources = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }

    const controller = new AbortController()
    const webglSupported = supportsWebGL()
    let cancelled = false

    setIsThumbnailLoaded(false)
    setState({
      photoId: photo.id,
      mode: 'loading',
      loadedBytes: 0,
      totalBytes: photo.original.bytes,
      progress: 0,
      renderSource: null,
    })
    releaseResources()

    const loadPhoto = async () => {
      const originalSource = `/api/photos/${encodeURIComponent(photo.slug)}`

      try {
        const response = await fetch(originalSource, {
          signal: controller.signal,
          cache: 'force-cache',
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`)
        }

        const headerBytes = Number(response.headers.get('content-length') ?? '')
        const totalBytes =
          Number.isFinite(headerBytes) && headerBytes > 0
            ? headerBytes
            : photo.original.bytes || null

        const blob = await readResponseAsBlob(
          response,
          controller.signal,
          photo.original.mime,
          (loadedBytes) => {
            if (cancelled) {
              return
            }

            setState((current) => ({
              ...current,
              photoId: photo.id,
              loadedBytes,
              totalBytes,
              progress:
                totalBytes && totalBytes > 0
                  ? Math.min(100, (loadedBytes / totalBytes) * 100)
                  : null,
            }))
          },
        )

        if (cancelled) {
          return
        }

        const objectUrl = URL.createObjectURL(blob)
        objectUrlRef.current = objectUrl
        setState({
          photoId: photo.id,
          mode: webglSupported ? 'webgl' : 'image',
          loadedBytes: totalBytes ?? blob.size,
          totalBytes,
          progress: 100,
          renderSource: objectUrl,
        })
      } catch {
        if (controller.signal.aborted || cancelled) {
          return
        }

        try {
          await preloadImage(photo.thumbnail.url)

          if (!cancelled) {
            setState({
              photoId: photo.id,
              mode: 'thumbnail',
              loadedBytes: 0,
              totalBytes: null,
              progress: null,
              renderSource: photo.thumbnail.url,
            })
          }
        } catch {
          if (!cancelled) {
            setState({
              photoId: photo.id,
              mode: 'error',
              loadedBytes: 0,
              totalBytes: null,
              progress: null,
              renderSource: null,
            })
          }
        }
      }
    }

    void loadPhoto()

    return () => {
      cancelled = true
      controller.abort()
      releaseResources()
    }
  }, [
    photo.id,
    photo.original.bytes,
    photo.original.mime,
    photo.slug,
    photo.thumbnail.url,
  ])

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
      <BlurhashCanvas
        hash={photo.blurhash}
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
        onLoad={() => setIsThumbnailLoaded(true)}
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
        <div className="pointer-events-none absolute inset-x-4 bottom-4 z-30 md:inset-x-auto md:right-5 md:bottom-5 md:w-72">
          <div className="overflow-hidden rounded-2xl border border-white/12 bg-black/42 backdrop-blur-xl">
            <div className="flex items-center justify-between px-4 pt-3 text-[11px] tracking-[0.18em] text-white/70 uppercase">
              <span>Loading original</span>
              <span>{progressLabel}</span>
            </div>
            <div className="px-4 pt-3 pb-4">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white/90 transition-[width] duration-200 ease-out"
                  style={{
                    width: `${Math.max(8, Math.round(state.progress ?? 12))}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-white/52">{bytesLabel}</p>
            </div>
          </div>
        </div>
      ) : null}

      {state.mode === 'thumbnail' ? (
        <div className="pointer-events-none absolute top-4 right-4 z-30 rounded-full border border-amber-200/20 bg-amber-300/12 px-3 py-1 text-[11px] tracking-[0.16em] text-amber-100/92 uppercase">
          Thumbnail fallback
        </div>
      ) : null}

      {state.mode === 'error' ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <div className="rounded-[1.5rem] border border-white/12 bg-black/32 px-6 py-4 text-center text-sm text-white/68">
            This frame could not be loaded.
          </div>
        </div>
      ) : null}
    </div>
  )
}
