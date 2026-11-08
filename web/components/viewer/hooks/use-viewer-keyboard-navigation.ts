import { useEffect, useEffectEvent } from 'react'

const NAVIGATION_STEPS: Partial<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
}

interface UseViewerKeyboardNavigationOptions {
  activeIndex: number
  canNavigate: boolean
  enabled: boolean
  onClose: () => void
  onGoTo: (index: number) => void
}

export function useViewerKeyboardNavigation({
  activeIndex,
  canNavigate,
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

    const step = NAVIGATION_STEPS[event.key]
    if (!canNavigate || step === undefined) {
      return
    }

    event.preventDefault()
    onGoTo(activeIndex + step)
  })

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
}
