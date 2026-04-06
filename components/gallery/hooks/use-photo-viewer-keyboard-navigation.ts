'use client'

import { useEffect } from 'react'

interface UsePhotoViewerKeyboardNavigationOptions {
  activeIndex: number
  onClose: () => void
  onGoTo: (index: number) => void
}

export function usePhotoViewerKeyboardNavigation({
  activeIndex,
  onClose,
  onGoTo,
}: UsePhotoViewerKeyboardNavigationOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onGoTo(activeIndex - 1)
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        onGoTo(activeIndex + 1)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeIndex, onClose, onGoTo])
}
