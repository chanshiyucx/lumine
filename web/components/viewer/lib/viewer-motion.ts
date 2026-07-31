import type { Transition } from 'motion/react'

const VIEWER_EASE_OUT = [0.22, 1, 0.36, 1] as const
const VIEWER_EXIT_EASE = [0.4, 0, 0.2, 1] as const

export const VIEWER_MOTION = {
  backdropEnter: { duration: 0.18, ease: 'easeOut' } satisfies Transition,
  backdropExit: { duration: 0.24, ease: 'easeOut' } satisfies Transition,
  chrome: {
    panel: {
      enter: {
        duration: 0.28,
        ease: VIEWER_EASE_OUT,
      } satisfies Transition,
      exit: {
        duration: 0.3,
        ease: VIEWER_EXIT_EASE,
      } satisfies Transition,
    },
    rail: {
      enter: {
        delay: 0.04,
        duration: 0.24,
        ease: VIEWER_EASE_OUT,
      } satisfies Transition,
      exit: {
        delay: 0.04,
        duration: 0.26,
        ease: VIEWER_EXIT_EASE,
      } satisfies Transition,
    },
    toolbar: {
      enter: {
        duration: 0.12,
        ease: VIEWER_EASE_OUT,
      } satisfies Transition,
      exit: {
        duration: 0.14,
        ease: VIEWER_EXIT_EASE,
      } satisfies Transition,
    },
  },
  contentFade: { duration: 0.1, ease: 'easeOut' } satisfies Transition,
  fadeExit: { duration: 0.16, ease: 'easeOut' } satisfies Transition,
  sharedEntryHandoffDelay: 0.3,
  sharedEnter: {
    duration: 0.48,
    ease: VIEWER_EASE_OUT,
  } satisfies Transition,
  sharedExit: {
    duration: 0.43,
    ease: VIEWER_EASE_OUT,
  } satisfies Transition,
  settle: {
    type: 'spring',
    stiffness: 380,
    damping: 34,
    mass: 0.75,
  } satisfies Transition,
} as const
