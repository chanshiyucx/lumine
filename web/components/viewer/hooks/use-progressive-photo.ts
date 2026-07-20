'use client'

import { useEffect, useState, type RefObject } from 'react'
import type { LoadingIndicatorRef } from '@/components/viewer/loading-indicator'
import type { Photo } from '@/lib/photos'
import {
  getCachedPhotoResource,
  peekCachedPhotoResource,
  setCachedPhotoResource,
} from '../lib/progressive-photo-cache'

interface ProgressiveState {
  blob: Blob | null
  blobSrc: string | null
  resourceLoaded: boolean
  error: boolean
}

interface UseProgressivePhotoOptions {
  isActive: boolean
  loadingIndicatorRef: RefObject<LoadingIndicatorRef | null>
}

function createInitialState(): ProgressiveState {
  return {
    blob: null,
    blobSrc: null,
    resourceLoaded: false,
    error: false,
  }
}

function createCachedState(blob: Blob, objectUrl: string): ProgressiveState {
  return {
    blob,
    blobSrc: objectUrl,
    resourceLoaded: true,
    error: false,
  }
}

function getChunkBlobPart(chunk: Uint8Array): BlobPart {
  const { buffer, byteLength, byteOffset } = chunk

  if (buffer instanceof ArrayBuffer) {
    if (byteOffset === 0 && byteLength === buffer.byteLength) {
      return buffer
    }

    return buffer.slice(byteOffset, byteOffset + byteLength)
  }

  return chunk.slice() as Uint8Array<ArrayBuffer>
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
  const chunks: BlobPart[] = []
  let loadedBytes = 0

  try {
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

      chunks.push(getChunkBlobPart(value))
      loadedBytes += value.byteLength
      onProgress(loadedBytes, totalBytes)
    }
  } finally {
    reader.releaseLock()
  }

  return new Blob(chunks, {
    type: response.headers.get('content-type') ?? mimeType,
  })
}

export function useProgressivePhoto(
  photo: Photo,
  { isActive, loadingIndicatorRef }: UseProgressivePhotoOptions,
) {
  const [state, setState] = useState<ProgressiveState>(() => {
    const cachedResource = peekCachedPhotoResource(photo.original.url)

    if (!cachedResource) {
      return createInitialState()
    }

    return createCachedState(cachedResource.blob, cachedResource.objectUrl)
  })

  useEffect(() => {
    if (!isActive || state.resourceLoaded || state.error) {
      return
    }

    const controller = new AbortController()
    const loadingIndicator = loadingIndicatorRef.current
    const cachedResource = getCachedPhotoResource(photo.original.url)

    if (cachedResource) {
      setState(createCachedState(cachedResource.blob, cachedResource.objectUrl))
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
            const progressTotalBytes = totalBytes ?? photo.original.bytes

            loadingIndicator?.updateLoadingState(photo.id, {
              isVisible: true,
              isError: false,
              isWebGLLoading: false,
              loadingProgress:
                progressTotalBytes > 0
                  ? Math.min(100, (loadedBytes / progressTotalBytes) * 100)
                  : 0,
              loadedBytes,
              totalBytes: progressTotalBytes,
            })
          },
        )

        if (controller.signal.aborted) {
          return
        }

        const objectUrl = URL.createObjectURL(blob)
        setCachedPhotoResource(photo.original.url, {
          blob,
          objectUrl,
          totalBytes: blob.size,
        })
        setState(createCachedState(blob, objectUrl))
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        console.error('Failed to load image:', error)
        setState({
          blob: null,
          blobSrc: null,
          resourceLoaded: false,
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
    state.resourceLoaded,
  ])

  return state
}
