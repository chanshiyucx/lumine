'use client'

import { useEffect, useState, type RefObject } from 'react'
import type { LoadingIndicatorRef } from '@/components/viewer/loading-indicator'
import type { GalleryPhoto } from '@/lib/photos'
import {
  getCachedPhotoResource,
  peekCachedPhotoResource,
  setCachedPhotoResource,
} from '../lib/progressive-photo-cache'

interface ProgressiveState {
  blobSrc: string | null
  highResLoaded: boolean
  error: boolean
}

interface UseProgressivePhotoOptions {
  isActive: boolean
  loadingIndicatorRef: RefObject<LoadingIndicatorRef | null>
}

function createInitialState(): ProgressiveState {
  return {
    blobSrc: null,
    highResLoaded: false,
    error: false,
  }
}

function createCachedState(objectUrl: string): ProgressiveState {
  return {
    blobSrc: objectUrl,
    highResLoaded: true,
    error: false,
  }
}

async function readResponseAsBlob(
  response: Response,
  signal: AbortSignal,
  mimeType: string,
  onProgress: (loadedBytes: number, totalBytes: number | null) => void,
) {
  const headerBytes = Number(response.headers.get('content-length') ?? '')
  const totalBytes =
    Number.isFinite(headerBytes) && headerBytes > 0 ? headerBytes : null

  if (!response.body) {
    const blob = await response.blob()
    onProgress(blob.size, totalBytes ?? blob.size)
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
    const chunkBuffer = chunk.buffer.slice(
      chunk.byteOffset,
      chunk.byteOffset + chunk.byteLength,
    ) as ArrayBuffer

    chunks.push(chunkBuffer)
    loadedBytes += value.byteLength
    onProgress(loadedBytes, totalBytes)
  }

  return new Blob(chunks, {
    type: response.headers.get('content-type') ?? mimeType,
  })
}

export function useProgressivePhoto(
  photo: GalleryPhoto,
  { isActive, loadingIndicatorRef }: UseProgressivePhotoOptions,
) {
  const [state, setState] = useState<ProgressiveState>(() => {
    const cachedResource = peekCachedPhotoResource(photo.original.url)

    if (!cachedResource) {
      return createInitialState()
    }

    return createCachedState(cachedResource.objectUrl)
  })

  useEffect(() => {
    if (!isActive || state.highResLoaded || state.error) {
      return
    }

    const controller = new AbortController()
    const loadingIndicator = loadingIndicatorRef.current
    const cachedResource = getCachedPhotoResource(photo.original.url)

    if (cachedResource) {
      setState(createCachedState(cachedResource.objectUrl))
      return () => {
        controller.abort()
      }
    }

    loadingIndicator?.updateLoadingState(photo.id, {
      isVisible: true,
      isError: false,
      isWebGLLoading: false,
      loadingProgress: 0,
      loadedBytes: 0,
      totalBytes: photo.original.bytes,
    })

    const loadImage = async () => {
      try {
        const response = await fetch(photo.original.url, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`)
        }

        const blob = await readResponseAsBlob(
          response,
          controller.signal,
          photo.original.mime,
          (loadedBytes, totalBytes) => {
            loadingIndicator?.updateLoadingState(photo.id, {
              isVisible: true,
              isError: false,
              isWebGLLoading: false,
              loadingProgress:
                totalBytes && totalBytes > 0
                  ? Math.min(100, (loadedBytes / totalBytes) * 100)
                  : 0,
              loadedBytes,
              totalBytes: totalBytes ?? photo.original.bytes,
            })
          },
        )

        if (controller.signal.aborted) {
          return
        }

        const objectUrl = URL.createObjectURL(blob)
        setCachedPhotoResource(photo.original.url, {
          objectUrl,
          totalBytes: blob.size,
        })
        setState(createCachedState(objectUrl))
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        console.error('Failed to load image:', error)
        setState({
          blobSrc: null,
          highResLoaded: false,
          error: true,
        })
        loadingIndicator?.updateLoadingState(photo.id, {
          isVisible: true,
          isError: true,
          errorMessage: 'Failed to load image',
        })
      }
    }

    void loadImage()

    return () => {
      controller.abort()
    }
  }, [
    isActive,
    loadingIndicatorRef,
    photo.id,
    photo.original.bytes,
    photo.original.mime,
    photo.original.url,
    state.error,
    state.highResLoaded,
  ])

  return state
}
