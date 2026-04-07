'use client'

import { useCallback, type RefObject } from 'react'
import type { LoadingIndicatorRef } from '../../viewer/loading-indicator'

function formatWebglStatusLabel(message?: string) {
  if (!message) {
    return 'Decoding image'
  }

  const normalizedMessage = message.toLowerCase()

  if (normalizedMessage.includes('texture')) {
    return 'Preparing texture'
  }

  if (
    normalizedMessage.includes('decode') ||
    normalizedMessage.includes('image') ||
    normalizedMessage.includes('loading')
  ) {
    return 'Decoding image'
  }

  return message
}

export function useWebGLLoadingState(
  loadingIndicatorRef: RefObject<LoadingIndicatorRef | null>,
  isActive: boolean,
  ownerId: string,
) {
  return useCallback(
    (
      isLoading: boolean,
      message?: string,
      quality?: 'high' | 'medium' | 'low' | 'unknown',
    ) => {
      if (!isActive) {
        return
      }

      if (!isLoading) {
        loadingIndicatorRef.current?.resetLoadingState(ownerId)
        return
      }

      loadingIndicatorRef.current?.updateLoadingState(ownerId, {
        isVisible: true,
        isError: false,
        isWebGLLoading: true,
        webglMessage: formatWebglStatusLabel(message),
        webglQuality: quality,
      })
    },
    [isActive, loadingIndicatorRef, ownerId],
  )
}
