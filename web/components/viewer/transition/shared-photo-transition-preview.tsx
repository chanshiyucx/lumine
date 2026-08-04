import { m, useIsPresent, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import type { Photo } from '@/lib/photo'
import { VIEWER_MOTION } from '../lib/viewer-motion'
import type { ViewerPhase } from '../lib/viewer-state'
import {
  fitMediaFrame,
  getFrameTransform,
  type ProjectedViewerFrame,
  type ViewerFrame,
} from './viewer-frame'

interface TransitionFrames {
  source: ViewerFrame
  target: ViewerFrame | ProjectedViewerFrame
}

interface SharedPhotoTransitionPreviewProps {
  mediaStageRef: RefObject<HTMLElement | null>
  onEntryComplete: (operationId: number) => void
  onEntryHandoff: (operationId: number) => void
  onExitComplete: (operationId: number) => void
  onPresenceExitComplete: (operationId: number) => void
  operationId: number
  phase: Extract<ViewerPhase, 'entering' | 'exiting'>
  photo: Photo
  sourceElement: HTMLElement
  viewerFrameOverride?: ProjectedViewerFrame | null
}

function readBorderRadius(element: HTMLElement) {
  const value = Number.parseFloat(window.getComputedStyle(element).borderRadius)
  return Number.isFinite(value) ? value : 0
}

function readFrame(element: HTMLElement): ViewerFrame {
  const rect = element.getBoundingClientRect()

  return {
    borderRadius: readBorderRadius(element),
    height: rect.height,
    left: rect.left,
    top: rect.top,
    width: rect.width,
  }
}

function setElementVisibility(element: HTMLElement, visibility: string) {
  element.style.visibility = visibility
}

export function SharedPhotoTransitionPreview({
  mediaStageRef,
  onEntryComplete,
  onEntryHandoff,
  onExitComplete,
  onPresenceExitComplete,
  operationId,
  phase,
  photo,
  sourceElement,
  viewerFrameOverride,
}: SharedPhotoTransitionPreviewProps) {
  const reduceMotion = useReducedMotion()
  const isPresent = useIsPresent()
  const [frames, setFrames] = useState<TransitionFrames | null>(null)
  const completedOperationRef = useRef<number | null>(null)
  const completedPresenceExitRef = useRef(false)

  useLayoutEffect(() => {
    const stage = mediaStageRef.current
    if (!stage || !sourceElement.isConnected) {
      if (phase === 'entering') {
        onEntryHandoff(operationId)
        onEntryComplete(operationId)
        onPresenceExitComplete(operationId)
      } else {
        onExitComplete(operationId)
      }
      return
    }

    const source = readFrame(sourceElement)
    const stageRect = stage.getBoundingClientRect()
    const target =
      viewerFrameOverride ??
      fitMediaFrame(
        {
          height: photo.original.height,
          width: photo.original.width,
        },
        stageRect,
      )

    if (
      source.width <= 0 ||
      source.height <= 0 ||
      target.width <= 0 ||
      target.height <= 0
    ) {
      if (phase === 'entering') {
        onEntryHandoff(operationId)
        onEntryComplete(operationId)
        onPresenceExitComplete(operationId)
      } else {
        onExitComplete(operationId)
      }
      return
    }

    const previousVisibility = sourceElement.style.visibility
    setElementVisibility(sourceElement, 'hidden')
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        setFrames({ source, target })
      }
    })

    return () => {
      cancelled = true
      if (sourceElement.isConnected) {
        setElementVisibility(sourceElement, previousVisibility)
      }
    }
  }, [
    mediaStageRef,
    onEntryComplete,
    onEntryHandoff,
    onExitComplete,
    onPresenceExitComplete,
    operationId,
    phase,
    photo.original.height,
    photo.original.width,
    sourceElement,
    viewerFrameOverride,
  ])

  useEffect(() => {
    if (phase !== 'entering' || frames === null) {
      return
    }

    if (reduceMotion) {
      onEntryHandoff(operationId)
      return
    }

    const timer = window.setTimeout(
      () => onEntryHandoff(operationId),
      VIEWER_MOTION.sharedEntryHandoffDelay * 1000,
    )

    return () => window.clearTimeout(timer)
  }, [frames, onEntryHandoff, operationId, phase, reduceMotion])

  const transform = frames
    ? getFrameTransform(frames.source, frames.target)
    : null

  if (!frames || !transform) {
    return null
  }

  const isEntering = phase === 'entering'
  const sourcePresentation = {
    borderRadius: frames.source.borderRadius,
    rotate: 0,
    scaleX: transform.scaleX,
    scaleY: transform.scaleY,
    x: transform.x,
    y: transform.y,
  }
  const targetPresentation = {
    borderRadius: frames.target.borderRadius,
    opacity: 1,
    rotate: 'rotate' in frames.target ? frames.target.rotate : 0,
    scaleX: 1,
    scaleY: 1,
    x: 0,
    y: 0,
  }
  const reducedInitialPresentation = {
    ...targetPresentation,
    opacity: isEntering ? 0 : 1,
  }
  const reducedTargetPresentation = {
    ...targetPresentation,
    opacity: isEntering ? 1 : 0,
  }

  return (
    <m.div
      data-viewer-transition={phase}
      className="pointer-events-none fixed z-40 overflow-hidden bg-black"
      style={{
        height: frames.target.height,
        left: frames.target.left,
        top: frames.target.top,
        transformOrigin: '0 0',
        width: frames.target.width,
      }}
      initial={
        reduceMotion
          ? reducedInitialPresentation
          : isEntering
            ? sourcePresentation
            : targetPresentation
      }
      animate={
        reduceMotion
          ? reducedTargetPresentation
          : isEntering
            ? targetPresentation
            : sourcePresentation
      }
      exit={{
        opacity: 0,
        transition: VIEWER_MOTION.contentFade,
      }}
      transition={
        reduceMotion
          ? VIEWER_MOTION.contentFade
          : isEntering
            ? VIEWER_MOTION.sharedEnter
            : VIEWER_MOTION.sharedExit
      }
      onAnimationComplete={() => {
        if (!isPresent) {
          if (!completedPresenceExitRef.current) {
            completedPresenceExitRef.current = true
            onPresenceExitComplete(operationId)
          }
          return
        }

        if (completedOperationRef.current === operationId) {
          return
        }

        completedOperationRef.current = operationId
        if (isEntering) {
          onEntryComplete(operationId)
        } else {
          onExitComplete(operationId)
        }
      }}
    >
      <Image
        src={photo.thumbnail.url}
        alt=""
        aria-hidden
        width={photo.thumbnail.width}
        height={photo.thumbnail.height}
        className="size-full object-cover"
        draggable={false}
        unoptimized
      />
    </m.div>
  )
}
