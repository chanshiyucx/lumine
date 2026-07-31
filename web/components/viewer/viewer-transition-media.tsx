/* eslint-disable @next/next/no-img-element */
import { m, useReducedMotion } from 'motion/react'
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import type { Photo } from '@/lib/photo'
import {
  fitMediaFrame,
  getFrameTransform,
  type ProjectedViewerFrame,
  type ViewerFrame,
} from './lib/viewer-frame'
import { VIEWER_MOTION } from './lib/viewer-motion'
import type { ViewerPhase } from './lib/viewer-state'

interface TransitionFrames {
  source: ViewerFrame
  target: ViewerFrame | ProjectedViewerFrame
}

interface ViewerTransitionMediaProps {
  mediaStageRef: RefObject<HTMLElement | null>
  onEntryComplete: (operationId: number) => void
  onExitComplete: (operationId: number) => void
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

export function ViewerTransitionMedia({
  mediaStageRef,
  onEntryComplete,
  onExitComplete,
  operationId,
  phase,
  photo,
  sourceElement,
  viewerFrameOverride,
}: ViewerTransitionMediaProps) {
  const reduceMotion = useReducedMotion()
  const [frames, setFrames] = useState<TransitionFrames | null>(null)
  const completedOperationRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    const stage = mediaStageRef.current
    if (!stage || !sourceElement.isConnected) {
      if (phase === 'entering') {
        onEntryComplete(operationId)
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
        onEntryComplete(operationId)
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
    onExitComplete,
    operationId,
    phase,
    photo.original.height,
    photo.original.width,
    sourceElement,
    viewerFrameOverride,
  ])

  const transform = useMemo(
    () => (frames ? getFrameTransform(frames.source, frames.target) : null),
    [frames],
  )

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
      className="pointer-events-none fixed z-300 overflow-hidden bg-black"
      style={{
        height: frames.target.height,
        left: frames.target.left,
        top: frames.target.top,
        transformOrigin: '0 0',
        width: frames.target.width,
        willChange: 'transform',
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
      transition={
        reduceMotion
          ? VIEWER_MOTION.contentFade
          : isEntering
            ? VIEWER_MOTION.sharedEnter
            : VIEWER_MOTION.sharedExit
      }
      onAnimationComplete={() => {
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
      <img
        src={photo.thumbnail.url}
        alt=""
        aria-hidden
        className="size-full object-cover"
        draggable={false}
      />
    </m.div>
  )
}
