'use client'

import { useCallback, useState, type MouseEvent, type RefObject } from 'react'
import type { GalleryPhoto } from '@/lib/photos'

export interface HoverPreviewState {
  index: number
  left: number
  top: number
  width: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function useHoverPreview(
  photos: GalleryPhoto[],
  railShellRef: RefObject<HTMLDivElement | null>,
) {
  const [hoverPreview, setHoverPreview] = useState<HoverPreviewState | null>(
    null,
  )

  const updateHoverPreview = useCallback(
    (index: number, button: HTMLButtonElement) => {
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        return
      }

      const railShell = railShellRef.current
      const photo = photos[index]

      if (!railShell || !photo) {
        return
      }

      const shellRect = railShell.getBoundingClientRect()
      const buttonRect = button.getBoundingClientRect()
      const previewHeight = clamp(
        Math.round(window.innerHeight * 0.24),
        180,
        240,
      )
      const previewWidth = clamp(
        Math.round(previewHeight * photo.aspectRatio),
        220,
        Math.max(220, Math.min(460, Math.floor(shellRect.width))),
      )
      const rawLeft = buttonRect.left + buttonRect.width / 2 - previewWidth / 2
      const maxLeft = Math.max(12, window.innerWidth - previewWidth - 12)
      const previewTop = Math.max(12, shellRect.top - previewHeight)

      setHoverPreview({
        index,
        left: clamp(rawLeft, 12, maxLeft),
        top: previewTop,
        width: previewWidth,
      })
    },
    [photos, railShellRef],
  )

  const handleThumbnailEnter = useCallback(
    (index: number, event: MouseEvent<HTMLButtonElement>) => {
      updateHoverPreview(index, event.currentTarget)
    },
    [updateHoverPreview],
  )

  const handleThumbnailMove = useCallback(
    (index: number, event: MouseEvent<HTMLButtonElement>) => {
      updateHoverPreview(index, event.currentTarget)
    },
    [updateHoverPreview],
  )

  const handleThumbnailLeave = useCallback(() => {
    setHoverPreview(null)
  }, [])

  return {
    hoverPreview,
    handleThumbnailEnter,
    handleThumbnailMove,
    handleThumbnailLeave,
  }
}
