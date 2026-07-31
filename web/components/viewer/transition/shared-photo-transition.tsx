'use client'

import { AnimatePresence } from 'motion/react'
import type { RefObject } from 'react'
import type { Photo } from '@/lib/photo'
import type { ViewerState } from '../lib/viewer-state'
import { SharedPhotoTransitionPreview } from './shared-photo-transition-preview'
import type { ProjectedViewerFrame } from './viewer-frame'

export interface ActiveSharedPhotoTransition {
  operationId: number
  phase: Extract<ViewerState['phase'], 'entering' | 'exiting'>
  sourceElement: HTMLElement
}

interface SharedPhotoTransitionProps {
  activeTransition: ActiveSharedPhotoTransition | null
  exitFrame: ProjectedViewerFrame | null
  mediaStageRef: RefObject<HTMLElement | null>
  onEntryComplete: (operationId: number) => void
  onEntryHandoff: (operationId: number) => void
  onExitComplete: (operationId: number) => void
  onPresenceExitComplete: (operationId: number) => void
  photo: Photo
}

export function resolveSharedPhotoTransition(
  state: ViewerState,
): ActiveSharedPhotoTransition | null {
  const isSharedEntry =
    state.phase === 'entering' && state.entryMode === 'shared'
  const isSharedExit = state.phase === 'exiting' && state.exitMode === 'shared'

  if ((!isSharedEntry && !isSharedExit) || state.triggerElement === null) {
    return null
  }

  return {
    operationId: state.operationId,
    phase: isSharedEntry ? 'entering' : 'exiting',
    sourceElement: state.triggerElement,
  }
}

export function SharedPhotoTransition({
  activeTransition,
  exitFrame,
  mediaStageRef,
  onEntryComplete,
  onEntryHandoff,
  onExitComplete,
  onPresenceExitComplete,
  photo,
}: SharedPhotoTransitionProps) {
  return (
    <AnimatePresence>
      {activeTransition && (
        <SharedPhotoTransitionPreview
          key={activeTransition.operationId}
          mediaStageRef={mediaStageRef}
          onEntryComplete={onEntryComplete}
          onEntryHandoff={onEntryHandoff}
          onExitComplete={onExitComplete}
          onPresenceExitComplete={onPresenceExitComplete}
          operationId={activeTransition.operationId}
          phase={activeTransition.phase}
          photo={photo}
          sourceElement={activeTransition.sourceElement}
          viewerFrameOverride={
            activeTransition.phase === 'exiting' ? exitFrame : null
          }
        />
      )}
    </AnimatePresence>
  )
}
