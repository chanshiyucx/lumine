import { useDrag } from '@use-gesture/react'
import { animate, useMotionValue, useTransform } from 'motion/react'
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type TouchEvent,
} from 'react'
import { clamp } from '@/lib/math'
import {
  getDismissPresentation,
  getInspectorSettleVelocity,
  getMobileGestureMetrics,
  shouldDismissViewer,
} from '../lib/mobile-viewer-gesture'
import { VIEWER_MOTION } from '../lib/viewer-motion'
import type { ViewerTransformSnapshot } from '../transition/viewer-frame'

const INSPECTOR_PRESENT_EPSILON = 0.02

type MobileStageActivity = 'idle' | 'vertical' | 'dismissing'
type MobileInteractionMode = 'interactive' | 'suspended' | 'exiting'

interface GestureMemo {
  ignore: boolean
  initialInspectorProgress: number
  startedWithInspectorOpen: boolean
}

interface UseMobileViewerInteractionsOptions {
  activeIndex: number
  mode: MobileInteractionMode
  isZoomed: boolean
  onDismiss: (snapshot: ViewerTransformSnapshot) => void
}

function getViewport() {
  return {
    height: typeof window === 'undefined' ? 844 : window.innerHeight,
    width: typeof window === 'undefined' ? 390 : window.innerWidth,
  }
}

export function useMobileViewerInteractions({
  activeIndex,
  mode,
  isZoomed,
  onDismiss,
}: UseMobileViewerInteractionsOptions) {
  const [viewport, setViewport] = useState(getViewport)
  const [infoOpen, setInfoOpen] = useState(false)
  const [activity, setActivity] = useState<MobileStageActivity>('idle')
  const [isInspectorPresent, setIsInspectorPresent] = useState(false)
  const dismissX = useMotionValue(0)
  const dismissY = useMotionValue(0)
  const inspectorProgress = useMotionValue(0)
  const activityRef = useRef<MobileStageActivity>('idle')
  const animationIdRef = useRef(0)
  const cancelDragRef = useRef<(() => void) | null>(null)
  const ignoreTouchDragRef = useRef(false)
  const inspectorPresentRef = useRef(false)
  const optionsRef = useRef({ activeIndex, mode, isZoomed, onDismiss })
  const metrics = getMobileGestureMetrics(viewport.height)

  const updateActivity = (next: MobileStageActivity) => {
    activityRef.current = next
    setActivity(next)
  }

  // Keep React updates at visibility boundaries instead of every animation frame.
  useEffect(
    () =>
      inspectorProgress.on('change', (progress) => {
        const present = progress > INSPECTOR_PRESENT_EPSILON
        if (present === inspectorPresentRef.current) return
        inspectorPresentRef.current = present
        setIsInspectorPresent(present)
      }),
    [inspectorProgress],
  )

  const stopAnimations = () => {
    animationIdRef.current += 1
    dismissX.stop()
    dismissY.stop()
    inspectorProgress.stop()
  }

  const settleInspector = (open: boolean, velocity = 0) => {
    if (
      optionsRef.current.mode !== 'interactive' ||
      (open && optionsRef.current.isZoomed)
    )
      return
    stopAnimations()
    setInfoOpen(open)
    updateActivity('idle')
    const progress = open ? 1 : 0
    const settleVelocity = getInspectorSettleVelocity(open, velocity)
    if (inspectorProgress.get() !== progress || settleVelocity !== 0) {
      animate(inspectorProgress, progress, {
        ...VIEWER_MOTION.inspector[open ? 'open' : 'close'],
        velocity: settleVelocity,
      })
    }
    for (const offset of [dismissX, dismissY]) {
      if (offset.get() !== 0) {
        animate(offset, 0, { ...VIEWER_MOTION.settle, velocity: 0 })
      }
    }
  }

  const cancelCurrentGesture = () => {
    ignoreTouchDragRef.current = true
    const cancel = cancelDragRef.current
    cancelDragRef.current = null
    cancel?.()
  }

  const resetInteraction = () => {
    cancelCurrentGesture()
    stopAnimations()
    updateActivity('idle')
    if (optionsRef.current.mode !== 'exiting') {
      dismissX.jump(0)
      dismissY.jump(0)
      inspectorProgress.jump(infoOpen ? 1 : 0)
    }
  }
  const syncOptions = useEffectEvent(() => {
    const previous = optionsRef.current
    optionsRef.current = { activeIndex, mode, isZoomed, onDismiss }
    const photoChanged = previous.activeIndex !== activeIndex
    if (
      !photoChanged &&
      previous.mode === mode &&
      previous.isZoomed === isZoomed
    )
      return
    // Switching photos can remove the touch target before its final touchend.
    if (photoChanged || mode !== 'interactive') {
      resetInteraction()
    } else if (isZoomed && (infoOpen || activityRef.current === 'vertical')) {
      cancelCurrentGesture()
      settleInspector(false)
    }
  })

  useEffect(() => {
    if (mode !== 'interactive') return
    const handleResize = () => {
      const nextViewport = getViewport()
      setViewport((current) =>
        current.height === nextViewport.height &&
        current.width === nextViewport.width
          ? current
          : nextViewport,
      )
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [mode])

  useEffect(
    () => () => {
      animationIdRef.current += 1
      dismissX.stop()
      dismissY.stop()
      inspectorProgress.stop()
    },
    [dismissX, dismissY, inspectorProgress],
  )

  const dismissWithThrow = (velocityX: number, velocityY: number) => {
    stopAnimations()
    const animationId = animationIdRef.current
    const currentX = dismissX.get()
    const currentY = dismissY.get()
    const targetX = clamp(
      currentX + velocityX * viewport.width * 0.1,
      -viewport.width * 0.22,
      viewport.width * 0.22,
    )
    const targetY = clamp(
      currentY + viewport.height * (0.08 + velocityY * 0.04),
      currentY + 40,
      viewport.height * 0.42,
    )
    updateActivity('dismissing')
    animate(dismissX, targetX, {
      type: 'spring',
      duration: 0.18,
      bounce: 0.08,
    })
    animate(dismissY, targetY, {
      type: 'spring',
      duration: 0.18,
      bounce: 0.04,
      onComplete: () => {
        if (animationIdRef.current !== animationId) return
        const presentation = getDismissPresentation(
          targetX,
          targetY,
          metrics.dismissTravel,
          viewport.width,
        )
        optionsRef.current.onDismiss({
          borderRadius: presentation.borderRadius,
          rotate: presentation.rotate,
          scale: presentation.scale,
          translateX: targetX,
          translateY: targetY,
        })
      },
    })
  }

  const bindDrag = useDrag(
    ({
      active,
      axis,
      cancel,
      canceled,
      direction: [directionX, directionY],
      event,
      first,
      last,
      memo,
      movement: [movementX, movementY],
      velocity: [velocityX, velocityY],
    }) => {
      const ignoreTouchDrag = 'touches' in event && ignoreTouchDragRef.current
      const gesture: GestureMemo = memo ?? {
        ignore: ignoreTouchDrag,
        initialInspectorProgress: inspectorProgress.get(),
        startedWithInspectorOpen:
          infoOpen || inspectorProgress.get() > INSPECTOR_PRESENT_EPSILON,
      }
      cancelDragRef.current = last ? null : cancel
      if (
        canceled ||
        event.type === 'touchcancel' ||
        event.type === 'pointercancel'
      ) {
        gesture.ignore = true
        if (activityRef.current === 'vertical') settleInspector(infoOpen)
        return gesture
      }
      if (
        optionsRef.current.mode !== 'interactive' ||
        optionsRef.current.isZoomed ||
        activityRef.current === 'dismissing' ||
        ignoreTouchDrag
      ) {
        gesture.ignore = true
        return gesture
      }
      if (
        first &&
        event.target instanceof Element &&
        event.target.closest(
          'button, a, input, select, textarea, [role="button"], [data-viewer-interactive]',
        )
      )
        gesture.ignore = true
      if (gesture.ignore || axis !== 'y') return gesture

      if (active) {
        if (activityRef.current !== 'vertical') {
          stopAnimations()
          updateActivity('vertical')
        }
        if (gesture.startedWithInspectorOpen) {
          inspectorProgress.set(
            clamp(
              gesture.initialInspectorProgress -
                movementY / metrics.inspectorTravel,
              0,
              1,
            ),
          )
          dismissX.set(0)
          dismissY.set(0)
        } else if (movementY < 0) {
          inspectorProgress.set(
            clamp(-movementY / metrics.inspectorTravel, 0, 1),
          )
          dismissX.set(0)
          dismissY.set(0)
        } else {
          const ratio = clamp(
            movementY / Math.max(metrics.dismissTravel, 1),
            0,
            1,
          )
          inspectorProgress.set(0)
          dismissY.set(movementY)
          dismissX.set(
            clamp(
              movementX * (0.18 + ratio * 0.1),
              -viewport.width * 0.2,
              viewport.width * 0.2,
            ),
          )
        }
      }
      if (last) {
        if (
          gesture.startedWithInspectorOpen ||
          inspectorProgress.get() > INSPECTOR_PRESENT_EPSILON
        ) {
          const shouldOpen =
            inspectorProgress.get() > 0.42 ||
            (directionY < 0 && velocityY > 0.2)
          settleInspector(shouldOpen, -directionY * velocityY)
        } else if (
          shouldDismissViewer({
            directionY,
            distance: dismissY.get(),
            threshold: metrics.dismissThreshold,
            velocityY,
          })
        ) {
          dismissWithThrow(
            velocityX * (directionX === 0 ? 1 : directionX),
            Math.max(velocityY, 0.72),
          )
        } else {
          settleInspector(false)
        }
      }
      return gesture
    },
    {
      axis: 'lock',
      filterTaps: true,
      pointer: { capture: false, touch: true, keys: false },
      rubberband: 0.12,
      threshold: 10,
    },
  )

  const handleTouchStartCapture = (event: TouchEvent<HTMLElement>) => {
    if (
      optionsRef.current.mode !== 'interactive' ||
      activityRef.current === 'dismissing'
    )
      return
    if (event.touches.length === 1) {
      ignoreTouchDragRef.current = false
    } else if (!ignoreTouchDragRef.current) {
      cancelCurrentGesture()
      if (activityRef.current === 'vertical') settleInspector(infoOpen)
    }
  }
  const bindStage = () => ({
    ...bindDrag(),
    onTouchStartCapture: handleTouchStartCapture,
  })

  const dismissPresentation = useTransform(() =>
    getDismissPresentation(
      dismissX.get(),
      dismissY.get(),
      metrics.dismissTravel,
      viewport.width,
    ),
  )
  const viewerScale = useTransform(
    () => dismissPresentation.get().scale - inspectorProgress.get() * 0.015,
  )
  const viewerY = useTransform(
    () => dismissY.get() - inspectorProgress.get() * 12,
  )
  const viewerRotate = useTransform(() => dismissPresentation.get().rotate)
  const viewerBorderRadius = useTransform(
    () => dismissPresentation.get().borderRadius + inspectorProgress.get() * 14,
  )
  const backdropOpacity = useTransform(
    () => dismissPresentation.get().backdropOpacity,
  )
  const chromeOpacity = useTransform(
    () =>
      dismissPresentation.get().chromeOpacity *
      (1 - inspectorProgress.get() * 0.92),
  )
  const railOpacity = useTransform(
    () =>
      dismissPresentation.get().chromeOpacity * (1 - inspectorProgress.get()),
  )
  const infoPanelY = useTransform(() => {
    const hiddenProgress = 1 - inspectorProgress.get()
    return `calc(${hiddenProgress * 100}% + ${hiddenProgress * 28}px)`
  })
  const infoPanelOpacity = useTransform(() =>
    clamp(inspectorProgress.get() * 1.6, 0, 1),
  )

  // Reset after derived MotionValues have re-subscribed in their layout effects.
  useLayoutEffect(() => {
    syncOptions()
  }, [activeIndex, mode, isZoomed, onDismiss])

  return {
    backdropOpacity,
    bindStage,
    chromeOpacity,
    dismissX,
    infoOpen,
    isInspectorPresent,
    isInspectorInputDisabled:
      activity === 'vertical' || activity === 'dismissing' || isZoomed,
    isStageBlocked:
      mode !== 'interactive' ||
      activity !== 'idle' ||
      infoOpen ||
      isInspectorPresent,
    infoPanelOpacity,
    infoPanelY,
    railOpacity,
    settleInspector,
    viewerBorderRadius,
    viewerRotate,
    viewerScale,
    viewerY,
  }
}
