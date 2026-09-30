import { useEffect, useRef, useState } from 'react'
import type { Photo } from '@/lib/photo'
import { loadPhotoBlob } from '../lib/load-photo-blob'

const BYTES_PER_MEBIBYTE = 1024 * 1024

interface PhotoResourceProgress {
  loadedBytes: number
  progress: number
  totalBytes: number
}

export type PhotoResourceState =
  | ({ status: 'loading' } & PhotoResourceProgress)
  | ({ src: string; status: 'decoding' } & PhotoResourceProgress)
  | { src: string; status: 'ready' }
  | { message: string; status: 'error' }

function getProgress(
  loadedBytes: number,
  totalBytes: number,
): PhotoResourceProgress {
  return {
    loadedBytes,
    progress:
      totalBytes > 0 ? Math.min(100, (loadedBytes / totalBytes) * 100) : 0,
    totalBytes,
  }
}

function hasSameProgressDisplay(
  current: PhotoResourceProgress,
  next: PhotoResourceProgress,
) {
  if (current.totalBytes !== next.totalBytes) {
    return false
  }

  if (next.totalBytes > 0) {
    return Math.floor(current.progress) === Math.floor(next.progress)
  }

  return (
    (current.loadedBytes === 0) === (next.loadedBytes === 0) &&
    (current.loadedBytes / BYTES_PER_MEBIBYTE).toFixed(1) ===
      (next.loadedBytes / BYTES_PER_MEBIBYTE).toFixed(1)
  )
}

export function useProgressivePhoto(photo: Photo, loadDelayMs = 0) {
  const { bytes, mime, url } = photo.original
  const [state, setState] = useState<PhotoResourceState>(() => ({
    ...getProgress(0, bytes),
    status: 'loading',
  }))
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      try {
        const blob = await loadPhotoBlob(
          url,
          mime,
          controller.signal,
          (loadedBytes, responseBytes) => {
            if (controller.signal.aborted) {
              return
            }

            const progress = getProgress(loadedBytes, responseBytes ?? bytes)
            setState((current) => {
              if (
                current.status === 'loading' &&
                hasSameProgressDisplay(current, progress)
              ) {
                return current
              }

              return { ...progress, status: 'loading' }
            })
          },
        )

        if (controller.signal.aborted) {
          return
        }

        const objectUrl = URL.createObjectURL(blob)
        objectUrlRef.current = objectUrl
        setState({
          ...getProgress(blob.size, blob.size),
          src: objectUrl,
          status: 'decoding',
        })
      } catch {
        if (!controller.signal.aborted) {
          setState({ message: 'Failed to load image', status: 'error' })
        }
      }
    }

    const timer = window.setTimeout(() => void load(), loadDelayMs)

    return () => {
      window.clearTimeout(timer)
      controller.abort()

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [bytes, loadDelayMs, mime, url])

  const markDecoded = () => {
    if (state.status !== 'decoding') {
      return
    }

    const src = state.src
    setState((current) =>
      current.status === 'decoding' && current.src === src
        ? { src, status: 'ready' }
        : current,
    )
  }

  const markRenderFailed = (error: Error) => {
    if (
      (state.status !== 'decoding' && state.status !== 'ready') ||
      objectUrlRef.current !== state.src
    ) {
      return
    }

    console.error('Failed to render image:', error)
    URL.revokeObjectURL(state.src)
    objectUrlRef.current = null
    setState({ message: 'Failed to render image', status: 'error' })
  }

  return { markDecoded, markRenderFailed, state }
}
