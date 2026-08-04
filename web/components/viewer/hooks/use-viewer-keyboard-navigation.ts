import { useEffect, useEffectEvent } from 'react'

interface UseViewerKeyboardNavigationOptions {
  activeIndex: number
  enabled: boolean
  onClose: () => void
  onGoTo: (index: number) => void
}

export function useViewerKeyboardNavigation({
  activeIndex,
  enabled,
  onClose,
  onGoTo,
}: UseViewerKeyboardNavigationOptions) {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!enabled || event.defaultPrevented) {
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      onGoTo(activeIndex - 1)
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      onGoTo(activeIndex + 1)
    }
  })

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      handleKeyDown(event)
    }

    document.addEventListener('keydown', listener)

    return () => {
      document.removeEventListener('keydown', listener)
    }
  }, [])
}
