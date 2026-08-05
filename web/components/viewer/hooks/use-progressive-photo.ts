import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { Photo } from '@/lib/photo'
import {
  getIdlePhotoResourceState,
  photoResourceStore,
} from '../lib/photo-resource-store'

interface UseProgressivePhotoOptions {
  isActive: boolean
  loadDelayMs?: number
}

export function useProgressivePhoto(
  photo: Photo,
  { isActive, loadDelayMs = 0 }: UseProgressivePhotoOptions,
) {
  const resourceKey = photo.original.url
  const subscribe = useCallback(
    (listener: () => void) =>
      photoResourceStore.subscribe(resourceKey, listener),
    [resourceKey],
  )
  const getSnapshot = useCallback(
    () => photoResourceStore.getSnapshot(resourceKey),
    [resourceKey],
  )
  const storedState = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getIdlePhotoResourceState,
  )
  const state = isActive ? storedState : getIdlePhotoResourceState()

  useEffect(() => {
    if (!isActive) {
      return
    }

    return photoResourceStore.activate(
      {
        bytes: photo.original.bytes,
        mime: photo.original.mime,
        url: resourceKey,
      },
      loadDelayMs,
    )
  }, [
    isActive,
    loadDelayMs,
    photo.original.bytes,
    photo.original.mime,
    resourceKey,
  ])

  const markDecoded = () => {
    if (state.status === 'cached' || state.status === 'decoding') {
      photoResourceStore.markDecoded(resourceKey, state.src)
    }
  }

  const markRenderFailed = (error: Error) => {
    if (
      state.status !== 'cached' &&
      state.status !== 'decoding' &&
      state.status !== 'ready'
    ) {
      return
    }

    console.error('Failed to render image:', error)
    photoResourceStore.markRenderFailed(
      resourceKey,
      state.src,
      'Failed to render image',
    )
  }

  return {
    markDecoded,
    markRenderFailed,
    state,
  }
}
