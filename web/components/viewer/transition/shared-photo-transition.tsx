'use client'

import { AnimatePresence } from 'motion/react'
import type { RefObject } from 'react'
import type { Photo } from '@/lib/photo'
import type { ActiveSharedPhotoTransition } from '../lib/shared-photo-transition'
import { SharedPhotoTransitionPreview } from './shared-photo-transition-preview'
import type { ProjectedViewerFrame } from './viewer-frame'

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
