'use client'

/* eslint-disable @next/next/no-img-element */
import { LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { WebGLImageViewer } from '@/components/webgl-viewer'
import type { GalleryPhoto } from '@/lib/photos'
import { cn } from '@/lib/utils/style'
import { BlurhashCanvas } from '../blurhash-canvas'
import { formatBytes } from './photo-masonry.utils'

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
          cache: 'no-store',
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
        <div className="pointer-events-none absolute right-4 bottom-4 z-30 md:right-5 md:bottom-5">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/72 px-3 py-2 backdrop-blur-xl">
            <LoaderCircle
              className="size-4 animate-spin text-white/78"
              strokeWidth={1.8}
            />
            <div className="min-w-[88px]">
              <p className="text-xs font-medium text-white tabular-nums">
                {progressLabel}
              </p>
              <p className="mt-0.5 text-[11px] text-white/58 tabular-nums">
                {bytesLabel}
              </p>
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
