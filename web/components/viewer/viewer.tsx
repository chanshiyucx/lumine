'use client'

import {
  ChevronLeft,
  ChevronRight,
  Info,
  PanelRightClose,
  PanelRightOpen,
  X,
} from 'lucide-react'
import { m } from 'motion/react'
import { useCallback, useRef, useState } from 'react'
import { RemoveScroll } from 'react-remove-scroll'
import { useMobile } from '@/hooks/use-mobile'
import type { Photo } from '@/lib/photo'
import { cn } from '@/lib/style'
import { useDialogFocus } from './hooks/use-dialog-focus'
import {
  useMobileViewerInteractions,
  type MobileDismissSnapshot,
} from './hooks/use-mobile-viewer-interactions'
import { useViewerKeyboardNavigation } from './hooks/use-viewer-keyboard-navigation'
import { VIEWER_MOTION } from './lib/viewer-motion'
import type { ViewerState } from './lib/viewer-state'
import { PhotoCarousel } from './photo-carousel'
import { ThumbnailRail } from './thumbnail-rail'
import {
  resolveSharedPhotoTransition,
  SharedPhotoTransition,
} from './transition/shared-photo-transition'
import {
  fitMediaFrame,
  projectViewerFrame,
  type ProjectedViewerFrame,
} from './transition/viewer-frame'
import {
  advanceViewerRevealState,
  createViewerRevealState,
  hasViewerRevealStage,
  type ViewerRevealStage,
} from './transition/viewer-reveal-state'
import { ViewerBackdrop } from './viewer-backdrop'
import { ViewerInfoPanel } from './viewer-info-panel'

const NAVIGATION_BUTTON_CLASS =
  'circle-button pointer-events-auto absolute top-1/2 hidden -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 lg:inline-flex'

interface ViewerProps {
  photos: Photo[]
  state: ViewerState
  getRestoreFocusElement: () => HTMLElement | null
  onClose: () => void
  onActiveIndexChange: (index: number) => void
  onEntryComplete: (operationId: number) => void
  onExitComplete: (operationId: number) => void
  onZoomStateChange: (isZoomed: boolean) => void
}

export function Viewer({
  photos,
  state,
  getRestoreFocusElement,
  onClose,
  onActiveIndexChange,
  onEntryComplete,
  onExitComplete,
  onZoomStateChange,
}: ViewerProps) {
  const isMobile = useMobile()
  const [isDesktopInfoPanelOpen, setIsDesktopInfoPanelOpen] = useState(true)
  const [isMobileInfoPanelOpen, setIsMobileInfoPanelOpen] = useState(false)
  const [dragExitFrame, setDragExitFrame] =
    useState<ProjectedViewerFrame | null>(null)
  const [revealState, setRevealState] = useState(() =>
    createViewerRevealState(
      state.operationId,
      state.entryMode === 'shared' ? 'hidden' : 'controls',
    ),
  )
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const mediaStageRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const infoButtonRef = useRef<HTMLButtonElement | null>(null)
  const activeIndex = state.activeIndex ?? 0
  const currentPhoto = photos[activeIndex]
  const isInteractionEnabled = state.phase === 'open'
  const canRevealWithoutSharedTransition = state.triggerElement === null
  const isViewerSurfaceVisible =
    state.phase !== 'exiting' &&
    (canRevealWithoutSharedTransition ||
      hasViewerRevealStage(revealState, state.operationId, 'surfaces'))
  const isViewerControlsVisible =
    isViewerSurfaceVisible &&
    (canRevealWithoutSharedTransition ||
      hasViewerRevealStage(revealState, state.operationId, 'controls'))
  const backdropEntryKey =
    state.phase === 'entering' ? state.operationId : revealState.operationId
  const sharedTransition = resolveSharedPhotoTransition(state)
  const isInfoPanelOpen = isMobile
    ? isMobileInfoPanelOpen
    : isDesktopInfoPanelOpen
  const canGoPrevious = activeIndex > 0
  const canGoNext = activeIndex < photos.length - 1
  const advanceReveal = useCallback(
    (operationId: number, stage: ViewerRevealStage) => {
      setRevealState((current) =>
        advanceViewerRevealState(current, operationId, stage),
      )
    },
    [],
  )
  const revealSurfaces = useCallback(
    (operationId: number) => advanceReveal(operationId, 'surfaces'),
    [advanceReveal],
  )
  const revealControls = useCallback(
    (operationId: number) => advanceReveal(operationId, 'controls'),
    [advanceReveal],
  )

  const handleMobileDismiss = useCallback(
    (snapshot: MobileDismissSnapshot) => {
      const stage = mediaStageRef.current
      if (stage) {
        const fittedFrame = fitMediaFrame(
          {
            height: currentPhoto.original.height,
            width: currentPhoto.original.width,
          },
          {
            height: stage.offsetHeight,
            left: stage.offsetLeft,
            top: stage.offsetTop,
            width: stage.offsetWidth,
          },
        )
        setDragExitFrame(
          projectViewerFrame(
            fittedFrame,
            {
              height: window.innerHeight,
              left: 0,
              top: 0,
              width: window.innerWidth,
            },
            snapshot,
          ),
        )
      }

      onClose()
    },
    [currentPhoto.original.height, currentPhoto.original.width, onClose],
  )

  const mobile = useMobileViewerInteractions({
    enabled: isMobile && state.phase !== 'entering',
    infoOpen: isMobileInfoPanelOpen,
    isZoomed: state.isZoomed,
    onDismiss: handleMobileDismiss,
    onInfoOpenChange: setIsMobileInfoPanelOpen,
  })

  const handleClose = useCallback(() => {
    setDragExitFrame(null)
    onClose()
  }, [onClose])

  useDialogFocus(dialogRef, closeButtonRef, getRestoreFocusElement)

  const goToPhoto = useCallback(
    (index: number) => {
      if (!isInteractionEnabled || index < 0 || index >= photos.length) {
        return
      }

      onActiveIndexChange(index)
    },
    [isInteractionEnabled, onActiveIndexChange, photos.length],
  )

  useViewerKeyboardNavigation({
    activeIndex,
    enabled: isInteractionEnabled,
    onClose: handleClose,
    onGoTo: goToPhoto,
  })

  const toggleInfoPanel = () => {
    if (isMobile) {
      mobile.settleInspector(!isMobileInfoPanelOpen)
      return
    }

    setIsDesktopInfoPanelOpen((current) => !current)
  }

  const handleInfoPanelClose = () => {
    if (isMobile) {
      mobile.settleInspector(false)
      window.requestAnimationFrame(() => {
        infoButtonRef.current?.focus({ preventScroll: true })
      })
      return
    }

    setIsDesktopInfoPanelOpen(false)
  }

  const handleViewerAnimationComplete = () => {
    if (state.phase === 'entering' && state.entryMode === 'fade') {
      onEntryComplete(state.operationId)
    } else if (state.phase === 'exiting' && state.exitMode === 'fade') {
      onExitComplete(state.operationId)
    }
  }

  return (
    <>
      <RemoveScroll enabled allowPinchZoom>
        <m.div
          ref={dialogRef}
          className="fixed inset-0 z-100 overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${currentPhoto.title}`}
          tabIndex={-1}
          initial={state.entryMode === 'fade' ? { opacity: 0 } : false}
          animate={{
            opacity:
              state.phase === 'exiting' && state.exitMode === 'fade' ? 0 : 1,
          }}
          transition={
            state.phase === 'exiting'
              ? VIEWER_MOTION.fadeExit
              : VIEWER_MOTION.backdropEnter
          }
          onAnimationComplete={handleViewerAnimationComplete}
        >
          <m.div
            data-viewer-layer="backdrop"
            className="absolute inset-0"
            style={{ opacity: isMobile ? mobile.backdropOpacity : 1 }}
            animate={{ opacity: state.phase === 'exiting' ? 0 : 1 }}
            transition={
              state.phase === 'exiting'
                ? VIEWER_MOTION.backdropExit
                : VIEWER_MOTION.backdropEnter
            }
          >
            <m.div
              key={backdropEntryKey}
              data-viewer-layer="backdrop-content"
              className="bg-base absolute inset-0"
              initial={
                state.phase === 'entering' && state.entryMode === 'shared'
                  ? { opacity: 0 }
                  : false
              }
              animate={{ opacity: 1 }}
              transition={VIEWER_MOTION.backdropEnter}
            >
              <ViewerBackdrop photo={currentPhoto} />
            </m.div>
          </m.div>

          <div
            data-viewer-layer="content"
            className="absolute inset-0 z-50 flex flex-col lg:flex-row"
          >
            <m.div
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              style={
                isMobile
                  ? {
                      borderRadius: mobile.viewerBorderRadius,
                      rotate: mobile.viewerRotate,
                      scale: mobile.viewerScale,
                      transformOrigin: '50% 18%',
                      x: mobile.dismissX,
                      y: mobile.viewerY,
                    }
                  : undefined
              }
            >
              <section
                {...(isMobile ? mobile.bindStage() : {})}
                ref={mediaStageRef}
                className="group relative min-h-0 min-w-0 flex-1 overflow-hidden"
                style={{
                  pointerEvents: isInteractionEnabled ? 'auto' : 'none',
                  touchAction: isMobile ? 'pan-x' : undefined,
                }}
              >
                <m.div
                  className="absolute top-[calc(env(safe-area-inset-top)+0.5rem)] right-[calc(env(safe-area-inset-right)+0.5rem)] z-50 flex gap-2"
                  data-viewer-chrome="toolbar"
                  initial={
                    state.phase === 'entering' ? { opacity: 0, y: -6 } : false
                  }
                  animate={{
                    opacity: isViewerControlsVisible ? 1 : 0,
                    y: isViewerControlsVisible ? 0 : -6,
                  }}
                  transition={
                    isViewerControlsVisible
                      ? VIEWER_MOTION.chrome.toolbar.enter
                      : VIEWER_MOTION.chrome.toolbar.exit
                  }
                  style={{
                    pointerEvents: isViewerControlsVisible ? 'auto' : 'none',
                  }}
                >
                  <m.div
                    className="flex gap-2"
                    style={{ opacity: isMobile ? mobile.chromeOpacity : 1 }}
                  >
                    <button
                      ref={infoButtonRef}
                      type="button"
                      className="circle-button"
                      onClick={toggleInfoPanel}
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
                      ref={closeButtonRef}
                      type="button"
                      className="circle-button"
                      onClick={handleClose}
                      aria-label="Close preview"
                    >
                      <X className="size-4" />
                    </button>
                  </m.div>
                </m.div>

                <div
                  className="absolute inset-0"
                  style={{ opacity: sharedTransition ? 0 : 1 }}
                >
                  <PhotoCarousel
                    photos={photos}
                    activeIndex={activeIndex}
                    isMobile={isMobile}
                    isSwipeDisabled={isMobileInfoPanelOpen}
                    isInteractionEnabled={isInteractionEnabled}
                    onActiveIndexChange={goToPhoto}
                    onZoomStateChange={onZoomStateChange}
                  />
                </div>

                <m.div
                  data-viewer-chrome="navigation"
                  className="pointer-events-none absolute inset-0 z-50"
                  initial={state.phase === 'entering' ? { opacity: 0 } : false}
                  animate={{ opacity: isViewerControlsVisible ? 1 : 0 }}
                  transition={
                    isViewerControlsVisible
                      ? VIEWER_MOTION.chrome.toolbar.enter
                      : VIEWER_MOTION.chrome.toolbar.exit
                  }
                >
                  {canGoPrevious && (
                    <button
                      type="button"
                      disabled={!isInteractionEnabled}
                      className={cn(NAVIGATION_BUTTON_CLASS, 'left-4')}
                      onClick={() => goToPhoto(activeIndex - 1)}
                      aria-label="Previous photo"
                    >
                      <ChevronLeft className="size-5" />
                    </button>
                  )}

                  {canGoNext && (
                    <button
                      type="button"
                      disabled={!isInteractionEnabled}
                      className={cn(NAVIGATION_BUTTON_CLASS, 'right-4')}
                      onClick={() => goToPhoto(activeIndex + 1)}
                      aria-label="Next photo"
                    >
                      <ChevronRight className="size-5" />
                    </button>
                  )}
                </m.div>
              </section>

              <m.div
                data-viewer-chrome="thumbnail-rail"
                initial={
                  state.phase === 'entering' ? { opacity: 0, y: 24 } : false
                }
                animate={{
                  opacity: isViewerSurfaceVisible ? 1 : 0,
                  y: isViewerSurfaceVisible ? 0 : 24,
                }}
                transition={
                  isViewerSurfaceVisible
                    ? VIEWER_MOTION.chrome.rail.enter
                    : VIEWER_MOTION.chrome.rail.exit
                }
                style={{
                  pointerEvents:
                    isViewerSurfaceVisible && isInteractionEnabled
                      ? 'auto'
                      : 'none',
                }}
              >
                <m.div style={{ opacity: isMobile ? mobile.railOpacity : 1 }}>
                  <ThumbnailRail
                    photos={photos}
                    activeIndex={activeIndex}
                    onSelect={goToPhoto}
                  />
                </m.div>
              </m.div>
            </m.div>

            <ViewerInfoPanel
              photo={currentPhoto}
              isOpen={isInfoPanelOpen}
              isViewerInteractive={isInteractionEnabled}
              isViewerVisible={isViewerSurfaceVisible}
              mobileStyle={
                isMobile
                  ? {
                      opacity: mobile.infoPanelOpacity,
                      y: mobile.infoPanelY,
                    }
                  : undefined
              }
              onClose={handleInfoPanelClose}
            />
          </div>

          <SharedPhotoTransition
            activeTransition={sharedTransition}
            exitFrame={dragExitFrame}
            mediaStageRef={mediaStageRef}
            onEntryComplete={onEntryComplete}
            onEntryHandoff={revealSurfaces}
            onExitComplete={onExitComplete}
            onPresenceExitComplete={revealControls}
            photo={currentPhoto}
          />
        </m.div>
      </RemoveScroll>
    </>
  )
}
