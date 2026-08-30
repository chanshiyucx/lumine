import { useEffect, useEffectEvent, type RefObject } from 'react'

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
      !element.closest('[aria-hidden="true"]') &&
      !element.closest('[inert]') &&
      element.getClientRects().length > 0,
  )
}

export function useDialogFocus(
  dialogRef: RefObject<HTMLElement | null>,
  getRestoreFocusElement?: () => HTMLElement | null,
) {
  const getLatestRestoreFocusElement = useEffectEvent(
    () => getRestoreFocusElement?.() ?? null,
  )

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus({ preventScroll: true })
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.defaultPrevented) {
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
        (activeElement === firstElement || !dialog.contains(activeElement))
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
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown)

      const restoreTarget =
        getLatestRestoreFocusElement() ??
        (previouslyFocused?.isConnected ? previouslyFocused : null)

      window.requestAnimationFrame(() => {
        restoreTarget?.focus({ preventScroll: true })
      })
    }
  }, [dialogRef])
}
