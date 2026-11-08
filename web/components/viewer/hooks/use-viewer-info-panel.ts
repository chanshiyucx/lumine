import { useState, type RefObject } from 'react'
import type { useMobileViewerInteractions } from './use-mobile-viewer-interactions'

type MobileInspector = Pick<
  ReturnType<typeof useMobileViewerInteractions>,
  | 'infoOpen'
  | 'isInspectorInputDisabled'
  | 'isInspectorPresent'
  | 'settleInspector'
>

interface UseViewerInfoPanelOptions {
  dialogRef: RefObject<HTMLElement | null>
  isMobile: boolean
  isZoomed: boolean
  mobile: MobileInspector
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
  const isInputDisabled = isMobile && mobile.isInspectorInputDisabled
  const isMobileSheetPresent =
    isMobile && (mobile.infoOpen || mobile.isInspectorPresent)

  const setOpen = (open: boolean) => {
    if (isMobile) {
      dialogRef.current?.focus({ preventScroll: true })
      mobile.settleInspector(open)
    } else {
      setIsDesktopOpen(open)
    }
  }

  const toggle = () => {
    if (canToggle) {
      setOpen(!isOpen)
    }
  }

  const close = () => setOpen(false)

  return {
    isOpen,
    canToggle,
    isInputDisabled,
    isMobileSheetPresent,
    close,
    toggle,
  }
}
