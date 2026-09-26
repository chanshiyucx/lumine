'use client'

import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  MotionConfig,
} from 'motion/react'
import { useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import { RemoveScroll } from 'react-remove-scroll'
import { useMobile } from '@/hooks/use-mobile'
import type { Photo } from '@/lib/photo'
import { useDialogFocus } from './hooks/use-dialog-focus'
import {
  useMobileViewerInteractions,
  type MobileDismissSnapshot,
} from './hooks/use-mobile-viewer-interactions'
import { useViewerKeyboardNavigation } from './hooks/use-viewer-keyboard-navigation'
import { resolveSharedPhotoTransition } from './lib/shared-photo-transition'
import { VIEWER_MOTION } from './lib/viewer-motion'
import type { MountedViewerState } from './lib/viewer-state'
import { PhotoCarousel } from './photo-carousel'
import { SharedPhotoTransition } from './transition/shared-photo-transition'
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
import {
  ViewerNavigation,
  ViewerThumbnailRail,
  ViewerToolbar,
} from './viewer-controls'
import { ViewerInfoPanel } from './viewer-info-panel'
import { ViewerShareDialog } from './viewer-share-dialog'

interface ViewerProps {
  photos: Photo[]
  state: MountedViewerState
  getRestoreFocusElement: () => HTMLElement | null
  onClose: () => void
  onActiveIndexChange: (index: number) => void
  onEntryComplete: (operationId: number) => void
  onExitComplete: (operationId: number) => void
  onPresenceChange: (present: boolean) => void
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
  onPresenceChange,
  onZoomStateChange,
}: ViewerProps) {
  const isMobile = useMobile()
  const [isDesktopInfoPanelOpen, setIsDesktopInfoPanelOpen] = useState(true)
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const [isShareDialogExiting, setIsShareDialogExiting] = useState(false)
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
  const reportPresence = useEffectEvent(onPresenceChange)

  useLayoutEffect(() => {
    reportPresence(true)
    return () => reportPresence(false)
  }, [])

  const activeIndex = state.activeIndex
  const currentPhoto = photos[activeIndex]
  const isInteractionEnabled = state.phase === 'open'
  const isShareDialogPresent = isShareDialogOpen || isShareDialogExiting
  const canRevealWithoutSharedTransition = state.triggerElement === null
  const isViewerSurfaceVisible =
    state.phase !== 'exiting' &&
    (canRevealWithoutSharedTransition ||
      hasViewerRevealStage(revealState, state.operationId, 'surfaces'))
  const isViewerControlsVisible =
    isViewerSurfaceVisible &&
    (canRevealWithoutSharedTransition ||
      hasViewerRevealStage(revealState, state.operationId, 'controls'))
  const sharedTransition = resolveSharedPhotoTransition(state)
  const advanceReveal = (operationId: number, stage: ViewerRevealStage) => {
    setRevealState((current) =>
      advanceViewerRevealState(current, operationId, stage),
    )
  }
  const revealSurfaces = (operationId: number) =>
    advanceReveal(operationId, 'surfaces')
  const revealControls = (operationId: number) =>
    advanceReveal(operationId, 'controls')

  const handleMobileDismiss = (snapshot: MobileDismissSnapshot) => {
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
  }

  const mobile = useMobileViewerInteractions({
    enabled: isMobile && state.phase !== 'entering' && !isShareDialogPresent,
    isZoomed: state.isZoomed,
    onDismiss: handleMobileDismiss,
  })
  const isInfoPanelOpen = isMobile ? mobile.infoOpen : isDesktopInfoPanelOpen

  const handleClose = () => {
    setDragExitFrame(null)
    onClose()
  }

  const handleOpenShareDialog = () => {
    setIsShareDialogExiting(false)
    setIsShareDialogOpen(true)
  }

  const handleCloseShareDialog = () => {
    setIsShareDialogExiting(true)
    setIsShareDialogOpen(false)
  }

  useDialogFocus(dialogRef, getRestoreFocusElement, !isShareDialogPresent)

  const goToPhoto = (index: number) => {
    if (!isInteractionEnabled || index < 0 || index >= photos.length) {
      return
    }

    onActiveIndexChange(index)
  }

  useViewerKeyboardNavigation({
    activeIndex,
    enabled: isInteractionEnabled && !isShareDialogPresent,
    onClose: handleClose,
    onGoTo: goToPhoto,
  })

  const toggleInfoPanel = () => {
    if (isMobile) {
      mobile.settleInspector(!mobile.infoOpen)
      return
    }

    setIsDesktopInfoPanelOpen((current) => !current)
  }

  const handleInfoPanelClose = () => {
    if (isMobile) {
      mobile.settleInspector(false)
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
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <RemoveScroll ref={dialogRef} forwardProps allowPinchZoom>
          <m.div
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
            <ViewerBackdrop
              photo={currentPhoto}
              state={state}
              revealOperationId={revealState.operationId}
              gestureOpacity={isMobile ? mobile.backdropOpacity : 1}
            />

            <div
              data-viewer-layer="content"
              className="absolute inset-0 z-50 flex flex-col lg:flex-row"
              inert={isShareDialogPresent}
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
                  <ViewerToolbar
                    chromeOpacity={isMobile ? mobile.chromeOpacity : 1}
                    isInfoPanelOpen={isInfoPanelOpen}
                    isShareDialogOpen={isShareDialogOpen}
                    isVisible={isViewerControlsVisible}
                    onClose={handleClose}
                    onOpenShareDialog={handleOpenShareDialog}
                    onToggleInfoPanel={toggleInfoPanel}
                    phase={state.phase}
                  />

                  <PhotoCarousel
                    photos={photos}
                    activeIndex={activeIndex}
                    concealedForSharedTransition={sharedTransition !== null}
                    isMobile={isMobile}
                    isZoomed={state.isZoomed}
                    isSwipeDisabled={isMobile && mobile.infoOpen}
                    isInteractionEnabled={isInteractionEnabled}
                    onActiveIndexChange={goToPhoto}
                    onZoomStateChange={onZoomStateChange}
                  />

                  <ViewerNavigation
                    activeIndex={activeIndex}
                    isVisible={isViewerControlsVisible}
                    onSelect={goToPhoto}
                    phase={state.phase}
                    photoCount={photos.length}
                  />
                </section>

                <ViewerThumbnailRail
                  activeIndex={activeIndex}
                  isVisible={isViewerSurfaceVisible}
                  onSelect={goToPhoto}
                  opacity={isMobile ? mobile.railOpacity : 1}
                  phase={state.phase}
                  photos={photos}
                />
              </m.div>

              <ViewerInfoPanel
                photo={currentPhoto}
                isOpen={isInfoPanelOpen}
                isViewerInteractive={isInteractionEnabled}
                isViewerVisible={isViewerSurfaceVisible}
                presentation={
                  isMobile
                    ? {
                        mode: 'mobile',
                        style: {
                          opacity: mobile.infoPanelOpacity,
                          y: mobile.infoPanelY,
                        },
                      }
                    : { mode: 'desktop' }
                }
                onClose={handleInfoPanelClose}
              />
            </div>

            <AnimatePresence
              onExitComplete={() => setIsShareDialogExiting(false)}
            >
              {isShareDialogOpen && (
                <ViewerShareDialog
                  key={currentPhoto.slug}
                  photo={currentPhoto}
                  returnFocusRef={dialogRef}
                  onClose={handleCloseShareDialog}
                />
              )}
            </AnimatePresence>

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
      </MotionConfig>
    </LazyMotion>
  )
}
