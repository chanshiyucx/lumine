import { CloseLine } from '@mingcute/react/close'
import { InformationLine } from '@mingcute/react/information'
import { LayoutRightbarCloseLine } from '@mingcute/react/layout-rightbar-close'
import { LayoutRightbarOpenLine } from '@mingcute/react/layout-rightbar-open'
import { LeftLine } from '@mingcute/react/left'
import { RightLine } from '@mingcute/react/right'
import { ShareForwardLine } from '@mingcute/react/share-forward'
import { m, type MotionValue } from 'motion/react'
import type { Photo } from '@/lib/photo'
import { cn } from '@/lib/style'
import { VIEWER_MOTION } from './lib/viewer-motion'
import type { ViewerPhase } from './lib/viewer-state'
import { ThumbnailRail } from './thumbnail-rail'

const NAVIGATION_BUTTON_CLASS =
  'circle-button pointer-events-auto absolute top-1/2 hidden -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 lg:inline-flex'

interface ViewerToolbarProps {
  chromeOpacity: number | MotionValue<number>
  isInfoPanelOpen: boolean
  isShareDialogOpen: boolean
  isVisible: boolean
  onClose: () => void
  onOpenShareDialog: () => void
  onToggleInfoPanel: () => void
  phase: ViewerPhase
}

export function ViewerToolbar({
  chromeOpacity,
  isInfoPanelOpen,
  isShareDialogOpen,
  isVisible,
  onClose,
  onOpenShareDialog,
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
          <InformationLine className="size-4 lg:hidden" aria-hidden="true" />
          {isInfoPanelOpen ? (
            <LayoutRightbarCloseLine
              className="hidden size-4 lg:block"
              aria-hidden="true"
            />
          ) : (
            <LayoutRightbarOpenLine
              className="hidden size-4 lg:block"
              aria-hidden="true"
            />
          )}
        </button>

        <button
          type="button"
          className="circle-button"
          onClick={onOpenShareDialog}
          aria-haspopup="dialog"
          aria-expanded={isShareDialogOpen}
          aria-label="Share photo"
        >
          <ShareForwardLine className="size-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          className="circle-button"
          onClick={onClose}
          aria-label="Close preview"
        >
          <CloseLine className="size-4" aria-hidden="true" />
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
          <LeftLine className="size-5" aria-hidden="true" />
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
          <RightLine className="size-5" aria-hidden="true" />
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
