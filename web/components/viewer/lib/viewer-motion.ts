import type { Transition } from 'motion/react'

export const VIEWER_MOTION = {
  backdropEnter: { duration: 0.18, ease: 'easeOut' } satisfies Transition,
  backdropExit: { duration: 0.14, ease: 'easeOut' } satisfies Transition,
  contentFade: { duration: 0.1, ease: 'easeOut' } satisfies Transition,
  fadeExit: { duration: 0.16, ease: 'easeOut' } satisfies Transition,
  sharedEnter: {
    type: 'spring',
    stiffness: 360,
    damping: 34,
    mass: 0.8,
  } satisfies Transition,
  sharedExit: {
    type: 'spring',
    stiffness: 420,
    damping: 38,
    mass: 0.72,
  } satisfies Transition,
  settle: {
    type: 'spring',
    stiffness: 380,
    damping: 34,
    mass: 0.75,
  } satisfies Transition,
} as const
