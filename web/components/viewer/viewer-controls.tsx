import {
  ChevronLeft,
  ChevronRight,
  Info,
  PanelRightClose,
  PanelRightOpen,
  X,
} from 'lucide-react'
import { m, type MotionValue } from 'motion/react'
import type { RefObject } from 'react'
import type { Photo } from '@/lib/photo'
import { cn } from '@/lib/style'
import { VIEWER_MOTION } from './lib/viewer-motion'
import type { ViewerPhase } from './lib/viewer-state'
import { ThumbnailRail } from './thumbnail-rail'

const NAVIGATION_BUTTON_CLASS =
  'circle-button pointer-events-auto absolute top-1/2 hidden -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 lg:inline-flex'

interface ViewerToolbarProps {
  chromeOpacity: number | MotionValue<number>
  infoButtonRef: RefObject<HTMLButtonElement | null>
  isInfoPanelOpen: boolean
  isVisible: boolean
  onClose: () => void
  onToggleInfoPanel: () => void
  phase: ViewerPhase
}

export function ViewerToolbar({
  chromeOpacity,
  infoButtonRef,
  isInfoPanelOpen,
  isVisible,
  onClose,
  onToggleInfoPanel,
  phase,
}: ViewerToolbarProps) {
  const isInteractive = isVisible && phase === 'open'

  return (
    <m.div
      className="absolute top-[calc(env(safe-area-inset-top)+0.5rem)] right-[calc(env(safe-area-inset-right)+0.5rem)] z-50 flex gap-2"
      data-viewer-chrome="toolbar"
      aria-hidden={!isInteractive}
      inert={!isInteractive}
      initial={phase === 'entering' ? { opacity: 0, y: -6 } : false}
      animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : -6 }}
      transition={
        isVisible
          ? VIEWER_MOTION.chrome.toolbar.enter
          : VIEWER_MOTION.chrome.toolbar.exit
      }
      style={{ pointerEvents: isInteractive ? 'auto' : 'none' }}
    >
      <m.div className="flex gap-2" style={{ opacity: chromeOpacity }}>
        <button
          ref={infoButtonRef}
          type="button"
          className="circle-button"
          onClick={onToggleInfoPanel}
          aria-expanded={isInfoPanelOpen}
          aria-label={
            isInfoPanelOpen
              ? 'Collapse information panel'
              : 'Expand information panel'
          }
        >
          <Info className="size-4 lg:hidden" />
          {isInfoPanelOpen ? (
            <PanelRightClose className="hidden size-4 lg:block" />
          ) : (
            <PanelRightOpen className="hidden size-4 lg:block" />
          )}
        </button>

        <button
          type="button"
          className="circle-button"
          onClick={onClose}
          aria-label="Close preview"
        >
          <X className="size-4" />
        </button>
      </m.div>
    </m.div>
  )
}

interface ViewerNavigationProps {
  activeIndex: number
  isVisible: boolean
  onSelect: (index: number) => void
  phase: ViewerPhase
  photoCount: number
}

export function ViewerNavigation({
  activeIndex,
  isVisible,
  onSelect,
  phase,
  photoCount,
}: ViewerNavigationProps) {
  const isInteractive = isVisible && phase === 'open'
  const canGoPrevious = activeIndex > 0
  const canGoNext = activeIndex < photoCount - 1

  return (
    <m.div
      data-viewer-chrome="navigation"
      aria-hidden={!isInteractive}
      inert={!isInteractive}
      className="pointer-events-none absolute inset-0 z-50"
      initial={phase === 'entering' ? { opacity: 0 } : false}
      animate={{ opacity: isVisible ? 1 : 0 }}
      transition={
        isVisible
          ? VIEWER_MOTION.chrome.toolbar.enter
          : VIEWER_MOTION.chrome.toolbar.exit
      }
    >
      {canGoPrevious && (
        <button
          type="button"
          disabled={!isInteractive}
          className={cn(NAVIGATION_BUTTON_CLASS, 'left-4')}
          onClick={() => onSelect(activeIndex - 1)}
          aria-label="Previous photo"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}

      {canGoNext && (
        <button
          type="button"
          disabled={!isInteractive}
          className={cn(NAVIGATION_BUTTON_CLASS, 'right-4')}
          onClick={() => onSelect(activeIndex + 1)}
          aria-label="Next photo"
        >
          <ChevronRight className="size-5" />
        </button>
      )}
    </m.div>
  )
}

interface ViewerThumbnailRailProps {
  activeIndex: number
  isVisible: boolean
  onSelect: (index: number) => void
  opacity: number | MotionValue<number>
  phase: ViewerPhase
  photos: Photo[]
}

export function ViewerThumbnailRail({
  activeIndex,
  isVisible,
  onSelect,
  opacity,
  phase,
  photos,
}: ViewerThumbnailRailProps) {
  const isInteractive = isVisible && phase === 'open'

  return (
    <m.div
      data-viewer-chrome="thumbnail-rail"
      aria-hidden={!isInteractive}
      inert={!isInteractive}
      initial={phase === 'entering' ? { opacity: 0, y: 24 } : false}
      animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 24 }}
      transition={
        isVisible
          ? VIEWER_MOTION.chrome.rail.enter
          : VIEWER_MOTION.chrome.rail.exit
      }
      style={{
        pointerEvents: isVisible && isInteractive ? 'auto' : 'none',
      }}
    >
      <m.div style={{ opacity }}>
        <ThumbnailRail
          photos={photos}
          activeIndex={activeIndex}
          onSelect={onSelect}
        />
      </m.div>
    </m.div>
  )
}
