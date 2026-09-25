import {
  AnimatePresence,
  m,
  useReducedMotion,
  type MotionValue,
} from 'motion/react'
import { ThumbHashImage } from '@/components/image'
import type { Photo } from '@/lib/photo'
import { VIEWER_MOTION } from './lib/viewer-motion'
import type { MountedViewerState } from './lib/viewer-state'

interface ViewerBackdropProps {
  photo: Pick<Photo, 'id' | 'thumbHash'>
  state: Pick<MountedViewerState, 'entryMode' | 'operationId' | 'phase'>
  revealOperationId: number
  gestureOpacity: number | MotionValue<number>
}

export function ViewerBackdrop({
  photo,
  state,
  revealOperationId,
  gestureOpacity,
}: ViewerBackdropProps) {
  const shouldReduceMotion = useReducedMotion()
  const transition = shouldReduceMotion
    ? { duration: 0 }
    : VIEWER_MOTION.photoSwitch
  const isExiting = state.phase === 'exiting'
  const entryKey =
    state.phase === 'entering' ? state.operationId : revealOperationId

  return (
    <m.div
      data-viewer-layer="backdrop"
      className="absolute inset-0"
      style={{ opacity: gestureOpacity }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={
        isExiting ? VIEWER_MOTION.backdropExit : VIEWER_MOTION.backdropEnter
      }
    >
      <m.div
        key={entryKey}
        data-viewer-layer="backdrop-content"
        className="bg-base pointer-events-none absolute inset-0 overflow-hidden"
        initial={
          state.phase === 'entering' && state.entryMode === 'shared'
            ? { opacity: 0 }
            : false
        }
        animate={{ opacity: 1 }}
        transition={VIEWER_MOTION.backdropEnter}
      >
        <AnimatePresence initial={false} mode="sync">
          <m.div
            key={`${photo.id}:${photo.thumbHash}`}
            data-viewer-backdrop-photo={photo.id}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
          >
            <ThumbHashImage thumbHash={photo.thumbHash} className="scale-110" />
          </m.div>
        </AnimatePresence>
      </m.div>
    </m.div>
  )
}
