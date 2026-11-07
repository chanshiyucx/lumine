import { useState, type RefObject } from 'react'
import type { useMobileViewerInteractions } from './use-mobile-viewer-interactions'

interface UseViewerInfoPanelOptions {
  dialogRef: RefObject<HTMLElement | null>
  isMobile: boolean
  isZoomed: boolean
  mobile: ReturnType<typeof useMobileViewerInteractions>
}

/** One open state for the desktop side panel and the mobile gesture sheet. */
export function useViewerInfoPanel({
  dialogRef,
  isMobile,
  isZoomed,
  mobile,
}: UseViewerInfoPanelOptions) {
  const [isDesktopOpen, setIsDesktopOpen] = useState(true)
  const isOpen = isMobile ? mobile.infoOpen : isDesktopOpen
  const canToggle = !isMobile || !isZoomed

  const setOpen = (open: boolean) => {
    if (isMobile) {
      dialogRef.current?.focus({ preventScroll: true })
      mobile.settleInspector(open)
      return
    }

    setIsDesktopOpen(open)
  }

  return {
    canToggle,
    close: () => setOpen(false),
    isInputDisabled: isMobile && mobile.isInspectorInputDisabled,
    // The mobile sheet covers the stage while it is open or moving.
    isMobileSheetPresent:
      isMobile && (mobile.infoOpen || mobile.isInspectorPresent),
    isOpen,
    toggle: () => {
      if (canToggle) {
        setOpen(!isOpen)
      }
    },
  }
}
