import type { Transition } from 'motion/react'

const VIEWER_OUT_EASE = [0.22, 1, 0.36, 1] as const
const VIEWER_EXIT_EASE = [0.4, 0, 0.2, 1] as const
const VIEWER_SURFACE_TRANSITIONS = {
  enter: {
    type: 'spring',
    duration: 0.3,
    bounce: 0,
  } satisfies Transition,
  exit: {
    type: 'spring',
    duration: 0.26,
    bounce: 0,
  } satisfies Transition,
}

export const VIEWER_MOTION = {
  backdropEnter: { duration: 0.18, ease: 'easeOut' } satisfies Transition,
  backdropExit: { duration: 0.24, ease: 'easeOut' } satisfies Transition,
  photoSwitch: { duration: 0.3, ease: 'linear' } satisfies Transition,
  chrome: {
    panel: VIEWER_SURFACE_TRANSITIONS,
    rail: VIEWER_SURFACE_TRANSITIONS,
    toolbar: {
      enter: {
        duration: 0.12,
        ease: VIEWER_OUT_EASE,
      } satisfies Transition,
      exit: {
        duration: 0.14,
        ease: VIEWER_EXIT_EASE,
      } satisfies Transition,
    },
  },
  contentFade: { duration: 0.1, ease: 'easeOut' } satisfies Transition,
  fadeExit: { duration: 0.16, ease: 'easeOut' } satisfies Transition,
  inspector: {
    close: {
      type: 'spring',
      duration: 0.28,
      bounce: 0,
    } satisfies Transition,
    open: {
      type: 'spring',
      duration: 0.32,
      bounce: 0,
    } satisfies Transition,
  },
  sharedEntryHandoffDelay: 0.3,
  sharedEnter: {
    duration: 0.48,
    ease: VIEWER_OUT_EASE,
  } satisfies Transition,
  sharedExit: {
    duration: 0.43,
    ease: VIEWER_OUT_EASE,
  } satisfies Transition,
  settle: {
    type: 'spring',
    stiffness: 380,
    damping: 34,
    mass: 0.75,
  } satisfies Transition,
} as const
