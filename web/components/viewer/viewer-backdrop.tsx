import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { ThumbHashImage } from '@/components/thumbhash'
import type { Photo } from '@/lib/photo'
import { VIEWER_MOTION } from './lib/viewer-motion'

interface ViewerBackdropProps {
  photo: Pick<Photo, 'id' | 'thumbHash'>
}

export function ViewerBackdrop({ photo }: ViewerBackdropProps) {
  const shouldReduceMotion = useReducedMotion()
  const transition = shouldReduceMotion
    ? { duration: 0 }
    : VIEWER_MOTION.photoSwitch

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
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
    </div>
  )
}
