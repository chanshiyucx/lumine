import { useDrag } from '@use-gesture/react'
import { animate, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import {
  clamp,
  getDismissPresentation,
  getInspectorSettleVelocity,
  getMobileGestureMetrics,
  shouldDismissViewer,
} from '../lib/mobile-viewer-gesture'
import { VIEWER_MOTION } from '../lib/viewer-motion'

export interface MobileDismissSnapshot {
  borderRadius: number
  rotate: number
  scale: number
  translateX: number
  translateY: number
}

interface GestureMemo {
  ignore: boolean
  initialInspectorProgress: number
  startedWithInspectorOpen: boolean
}

interface UseMobileViewerInteractionsOptions {
  enabled: boolean
  isZoomed: boolean
  onDismiss: (snapshot: MobileDismissSnapshot) => void
}

function getViewport() {
  return {
    height: typeof window === 'undefined' ? 844 : window.innerHeight,
    width: typeof window === 'undefined' ? 390 : window.innerWidth,
  }
}

export function useMobileViewerInteractions({
  enabled,
  isZoomed,
  onDismiss,
}: UseMobileViewerInteractionsOptions) {
  const [viewport, setViewport] = useState(getViewport)
  const [infoOpen, setInfoOpen] = useState(false)
  const dismissX = useMotionValue(0)
  const dismissY = useMotionValue(0)
  const inspectorProgress = useMotionValue(0)
  const closingRef = useRef(false)
  const animationsRef = useRef<ReturnType<typeof animate>[]>([])
  const metrics = getMobileGestureMetrics(viewport.height)

  const stopAnimations = () => {
    animationsRef.current.forEach((animation) => animation.stop())
    animationsRef.current = []
  }

  const registerAnimation = (animation: ReturnType<typeof animate>) => {
    animationsRef.current.push(animation)
    return animation
  }

  const settle = (value: typeof dismissX, target: number, velocity = 0) => {
    return registerAnimation(
      animate(value, target, {
        ...VIEWER_MOTION.settle,
        velocity,
      }),
    )
  }

  const settleInspector = (open: boolean, velocity = 0) => {
    stopAnimations()
    setInfoOpen(open)
    registerAnimation(
      animate(inspectorProgress, open ? 1 : 0, {
        ...VIEWER_MOTION.inspector[open ? 'open' : 'close'],
        velocity: getInspectorSettleVelocity(open, velocity),
      }),
    )
    settle(dismissX, 0)
    settle(dismissY, 0)
  }

  useEffect(() => {
    const handleResize = () => setViewport(getViewport())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!enabled) {
      animationsRef.current.forEach((animation) => animation.stop())
      animationsRef.current = []
      closingRef.current = false
      dismissX.set(0)
      dismissY.set(0)
      inspectorProgress.set(infoOpen ? 1 : 0)
    }
  }, [dismissX, dismissY, enabled, infoOpen, inspectorProgress])

  const dismissWithThrow = (velocityX: number, velocityY: number) => {
    closingRef.current = true
    stopAnimations()
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

    registerAnimation(
      animate(dismissX, targetX, {
        type: 'spring',
        duration: 0.18,
        bounce: 0.08,
      }),
    )
    registerAnimation(
      animate(dismissY, targetY, {
        type: 'spring',
        duration: 0.18,
        bounce: 0.04,
        onComplete: () => {
          const presentation = getDismissPresentation(
            targetX,
            targetY,
            metrics.dismissTravel,
            viewport.width,
          )
          onDismiss({
            borderRadius: presentation.borderRadius,
            rotate: presentation.rotate,
            scale: presentation.scale,
            translateX: targetX,
            translateY: targetY,
          })
        },
      }),
    )
  }

  const bindStage = useDrag(
    ({
      active,
      axis,
      direction: [directionX, directionY],
      event,
      first,
      last,
      memo,
      movement: [movementX, movementY],
      velocity: [velocityX, velocityY],
    }) => {
      if (!enabled || isZoomed || closingRef.current) {
        return memo
      }

      const gesture: GestureMemo = memo ?? {
        ignore: false,
        initialInspectorProgress: inspectorProgress.get(),
        startedWithInspectorOpen: infoOpen || inspectorProgress.get() > 0.02,
      }

      if (first) {
        const target = event.target
        if (
          target instanceof Element &&
          target.closest(
            'button, a, input, select, textarea, [role="button"], [data-viewer-interactive]',
          )
        ) {
          gesture.ignore = true
        }
      }

      if (gesture.ignore || (axis && axis !== 'y')) {
        return gesture
      }

      if (active) {
        stopAnimations()

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
          inspectorProgress.get() > 0.02
        ) {
          const progress = inspectorProgress.get()
          const shouldOpen =
            progress > 0.42 || (directionY < 0 && velocityY > 0.2)
          settleInspector(shouldOpen, -directionY * velocityY)
          return gesture
        }

        const distance = dismissY.get()
        if (
          shouldDismissViewer({
            directionY,
            distance,
            threshold: metrics.dismissThreshold,
            velocityY,
          })
        ) {
          dismissWithThrow(
            velocityX * (directionX === 0 ? 1 : directionX),
            Math.max(velocityY, 0.72),
          )
          return gesture
        }

        settle(dismissX, 0)
        settle(dismissY, 0)
      }

      return gesture
    },
    {
      axis: 'lock',
      filterTaps: true,
      pointer: { capture: false, touch: true },
      rubberband: 0.12,
      threshold: 10,
    },
  )

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

  return {
    backdropOpacity,
    bindStage,
    chromeOpacity,
    dismissX,
    infoOpen,
    infoPanelOpacity,
    infoPanelY,
    inspectorProgress,
    railOpacity,
    settleInspector,
    viewerBorderRadius,
    viewerRotate,
    viewerScale,
    viewerY,
  }
}
