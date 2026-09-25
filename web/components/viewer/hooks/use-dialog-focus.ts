import { useEffect, useEffectEvent, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.closest('[aria-hidden="true"]') &&
      !element.closest('[inert]') &&
      element.getClientRects().length > 0,
  )
}

export function useDialogFocus(
  dialogRef: RefObject<HTMLElement | null>,
  getRestoreFocusElement: () => HTMLElement | null,
  trapFocus: boolean,
) {
  const restoreFrameRef = useRef<number | null>(null)
  const getLatestRestoreFocusElement = useEffectEvent(getRestoreFocusElement)

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!trapFocus || event.key !== 'Tab' || event.defaultPrevented) {
      return
    }

    const dialog = dialogRef.current
    if (!dialog) {
      return
    }

    const focusableElements = getFocusableElements(dialog)
    const firstElement = focusableElements[0]
    const lastElement = focusableElements.at(-1)
    if (!firstElement || !lastElement) {
      event.preventDefault()
      dialog.focus({ preventScroll: true })
      return
    }

    const activeElement = document.activeElement
    if (
      event.shiftKey &&
      (activeElement === firstElement ||
        activeElement === dialog ||
        !dialog.contains(activeElement))
    ) {
      event.preventDefault()
      lastElement.focus()
      return
    }

    if (
      !event.shiftKey &&
      (activeElement === lastElement || !dialog.contains(activeElement))
    ) {
      event.preventDefault()
      firstElement.focus()
    }
  })

  useEffect(() => {
    if (restoreFrameRef.current !== null) {
      window.cancelAnimationFrame(restoreFrameRef.current)
      restoreFrameRef.current = null
    }

    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus({ preventScroll: true })
    })
    const listener = (event: KeyboardEvent) => handleKeyDown(event)

    document.addEventListener('keydown', listener)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', listener)

      restoreFrameRef.current = window.requestAnimationFrame(() => {
        restoreFrameRef.current = null
        const target = getLatestRestoreFocusElement()
        if (target?.isConnected && !target.closest('[inert]')) {
          target.focus({ preventScroll: true })
        }
      })
    }
  }, [dialogRef])
}
