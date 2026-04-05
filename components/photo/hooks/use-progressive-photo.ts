'use client'

import { useEffect, useRef, useState } from 'react'
import type { GalleryPhoto } from '@/lib/photos'

export type RenderMode = 'loading' | 'webgl' | 'image' | 'thumbnail' | 'error'

export interface ProgressiveState {
  photoId: string
  mode: RenderMode
  loadedBytes: number
  totalBytes: number | null
  progress: number | null
  renderSource: string | null
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

function createInitialState(
  photoId: string,
  originalBytes: number,
): ProgressiveState {
  return {
    photoId,
    mode: 'loading',
    loadedBytes: 0,
    totalBytes: originalBytes,
    progress: 0,
    renderSource: null,
  }
}

export function useProgressivePhoto(photo: GalleryPhoto) {
  const [isThumbnailLoaded, setIsThumbnailLoaded] = useState(false)
  const [state, setState] = useState<ProgressiveState>(() =>
    createInitialState(photo.id, photo.original.bytes),
  )
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
    setState(createInitialState(photo.id, photo.original.bytes))
    releaseResources()

    const loadPhoto = async () => {
      const originalSource = photo.original.url

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
    photo.original.url,
    photo.thumbnail.url,
  ])

  return {
    isThumbnailLoaded,
    handleThumbnailLoad: () => setIsThumbnailLoaded(true),
    state,
  }
}
