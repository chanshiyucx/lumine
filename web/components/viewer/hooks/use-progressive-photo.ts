import { useEffect, useRef, useState, type RefObject } from 'react'
import type { Photo } from '@/lib/photo'
import {
  getCachedPhotoUrl,
  peekCachedPhotoUrl,
  setCachedPhotoUrl,
} from '../lib/progressive-photo-cache'
import type { LoadingIndicatorHandle } from '../loading-indicator'

interface ProgressiveState {
  blobSrc: string | null
  error: boolean
}

interface UseProgressivePhotoOptions {
  isActive: boolean
  loadDelayMs?: number
  loadingIndicatorRef: RefObject<LoadingIndicatorHandle | null>
}

function createInitialState(): ProgressiveState {
  return {
    blobSrc: null,
    error: false,
  }
}

function createCachedState(objectUrl: string): ProgressiveState {
  return {
    blobSrc: objectUrl,
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

function assertSuccessfulResponse(response: Response) {
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }
}

export function useProgressivePhoto(
  photo: Photo,
  {
    isActive,
    loadDelayMs = 0,
    loadingIndicatorRef,
  }: UseProgressivePhotoOptions,
) {
  const [state, setState] = useState<ProgressiveState>(() => {
    const cachedPhotoUrl = peekCachedPhotoUrl(photo.original.url)

    if (!cachedPhotoUrl) {
      return createInitialState()
    }

    return createCachedState(cachedPhotoUrl)
  })
  const shouldRetryOnActivationRef = useRef(false)
  const cachedPhotoUrl = peekCachedPhotoUrl(photo.original.url)
  const currentState: ProgressiveState = cachedPhotoUrl
    ? createCachedState(cachedPhotoUrl)
    : {
        blobSrc: null,
        error: state.error,
      }

  useEffect(() => {
    if (!isActive) {
      shouldRetryOnActivationRef.current = true
      return
    }

    if (cachedPhotoUrl) {
      getCachedPhotoUrl(photo.original.url)
      return
    }

    if (state.error && !shouldRetryOnActivationRef.current) {
      return
    }

    shouldRetryOnActivationRef.current = false

    const controller = new AbortController()
    let loadTimer: number | null = null
    const loadingIndicator = loadingIndicatorRef.current

    loadingIndicator?.updateLoadingState({
      isVisible: true,
      isError: false,
      loadingProgress: 0,
      loadedBytes: 0,
      totalBytes: photo.original.bytes,
    })

    const loadImage = async () => {
      try {
        const response = await fetch(photo.original.url, {
          signal: controller.signal,
        })
        assertSuccessfulResponse(response)

        const blob = await readResponseAsBlob(
          response,
          controller.signal,
          photo.original.mime,
          (loadedBytes, totalBytes) => {
            const progressTotalBytes = totalBytes ?? photo.original.bytes

            loadingIndicator?.updateLoadingState({
              isVisible: true,
              isError: false,
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
        setCachedPhotoUrl(photo.original.url, objectUrl)
        setState(createCachedState(objectUrl))
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        console.error('Failed to load image:', error)
        setState({
          blobSrc: null,
          error: true,
        })
        loadingIndicator?.updateLoadingState({
          isVisible: true,
          isError: true,
          errorMessage: 'Failed to load image',
        })
      }
    }

    loadTimer = window.setTimeout(() => {
      loadTimer = null
      void loadImage()
    }, loadDelayMs)

    return () => {
      if (loadTimer !== null) {
        window.clearTimeout(loadTimer)
      }
      controller.abort()
    }
  }, [
    isActive,
    loadDelayMs,
    loadingIndicatorRef,
    photo.original.bytes,
    photo.original.mime,
    photo.original.url,
    cachedPhotoUrl,
    state.error,
  ])

  return currentState
}
