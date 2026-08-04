'use client'

import { m } from 'motion/react'
import { useRef, useState } from 'react'
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
import type { ViewerState } from './lib/viewer-state'
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
    enabled: isMobile && state.phase !== 'entering',
    isZoomed: state.isZoomed,
    onDismiss: handleMobileDismiss,
  })
  const isInfoPanelOpen = isMobile ? mobile.infoOpen : isDesktopInfoPanelOpen

  const handleClose = () => {
    setDragExitFrame(null)
    onClose()
  }

  useDialogFocus(dialogRef, closeButtonRef, getRestoreFocusElement)

  const goToPhoto = (index: number) => {
    if (!isInteractionEnabled || index < 0 || index >= photos.length) {
      return
    }

    onActiveIndexChange(index)
  }

  useViewerKeyboardNavigation({
    activeIndex,
    enabled: isInteractionEnabled,
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
                <ViewerToolbar
                  chromeOpacity={isMobile ? mobile.chromeOpacity : 1}
                  closeButtonRef={closeButtonRef}
                  infoButtonRef={infoButtonRef}
                  isInfoPanelOpen={isInfoPanelOpen}
                  isVisible={isViewerControlsVisible}
                  onClose={handleClose}
                  onToggleInfoPanel={toggleInfoPanel}
                  phase={state.phase}
                />

                <div
                  className="absolute inset-0"
                  style={{ opacity: sharedTransition ? 0 : 1 }}
                >
                  <PhotoCarousel
                    photos={photos}
                    activeIndex={activeIndex}
                    isMobile={isMobile}
                    isSwipeDisabled={mobile.infoOpen}
                    isInteractionEnabled={isInteractionEnabled}
                    onActiveIndexChange={goToPhoto}
                    onZoomStateChange={onZoomStateChange}
                  />
                </div>

                <ViewerNavigation
                  activeIndex={activeIndex}
                  onSelect={goToPhoto}
                  phase={state.phase}
                  photoCount={photos.length}
                  visibility={isViewerControlsVisible ? 'visible' : 'hidden'}
                />
              </section>

              <ViewerThumbnailRail
                activeIndex={activeIndex}
                isInteractive={isInteractionEnabled}
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
