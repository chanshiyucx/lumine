'use client'

import { animate, m, useMotionValue } from 'motion/react'
import { useEffect, useRef, type PointerEvent } from 'react'
import { AlbumPreviewContent } from './album-preview-card'
import { ClusterPreviewContent } from './cluster-preview-card'
import type { AlbumMapItem } from './lib/album-map-data'
import { shouldDismissMobilePreview } from './lib/map-preview-interaction'

export type MobileMapPreview =
  | { type: 'album'; item: AlbumMapItem }
  | { type: 'cluster'; count: number; items: AlbumMapItem[] }

interface DragSession {
  pointerId: number
  startTime: number
  startY: number
}

export function MobileMapPreviewSheet({
  preview,
  onDismiss,
  onHeightChange,
}: {
  preview: MobileMapPreview
  onDismiss: () => void
  onHeightChange: (height: number) => void
}) {
  const sheetRef = useRef<HTMLElement>(null)
  const dragSessionRef = useRef<DragSession | null>(null)
  const dragY = useMotionValue(0)
  const animationRef = useRef<ReturnType<typeof animate> | null>(null)

  const stopAnimation = () => {
    animationRef.current?.stop()
    animationRef.current = null
  }

  const settleDrag = () => {
    stopAnimation()
    animationRef.current = animate(dragY, 0, {
      type: 'spring',
      stiffness: 480,
      damping: 38,
    })
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onDismiss])

  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet) return

    const reportHeight = () => onHeightChange(sheet.offsetHeight)
    const resizeObserver = new ResizeObserver(reportHeight)

    reportHeight()
    resizeObserver.observe(sheet)

    return () => resizeObserver.disconnect()
  }, [onHeightChange])

  useEffect(() => () => stopAnimation(), [])

  const label =
    preview.type === 'album'
      ? `${preview.item.label} album preview`
      : `${preview.count} albums in this area`

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    stopAnimation()
    dragSessionRef.current = {
      pointerId: event.pointerId,
      startTime: performance.now(),
      startY: event.clientY,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const updateDrag = (event: PointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current
    if (!session || event.pointerId !== session.pointerId) return

    dragY.set(Math.max(0, event.clientY - session.startY))
  }

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current
    if (!session || event.pointerId !== session.pointerId) return

    const distance = Math.max(0, event.clientY - session.startY)
    const elapsed = Math.max(performance.now() - session.startTime, 1)

    dragSessionRef.current = null
    if (shouldDismissMobilePreview({ distance, elapsedMs: elapsed })) {
      stopAnimation()
      animationRef.current = animate(
        dragY,
        Math.max(sheetRef.current?.offsetHeight ?? 0, distance + 80),
        {
          duration: 0.18,
          ease: [0.4, 0, 1, 1],
          onComplete: onDismiss,
        },
      )
      return
    }

    settleDrag()
  }

  const cancelDrag = () => {
    dragSessionRef.current = null
    settleDrag()
  }

  return (
    <m.div
      className="fixed right-2 bottom-0 left-2 z-50 mx-auto max-w-lg"
      style={{ y: dragY }}
    >
      <section
        ref={sheetRef}
        aria-label={label}
        data-mobile-map-preview={preview.type}
        className="mobile-map-preview-sheet border-overlay bg-surface/98 max-h-[min(70svh,34rem)] w-full overflow-hidden rounded-t-3xl border border-b-0 shadow-2xl"
      >
        <div
          className="flex h-7 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
          aria-hidden
          onPointerDown={startDrag}
          onPointerMove={updateDrag}
          onPointerUp={finishDrag}
          onPointerCancel={cancelDrag}
        >
          <span className="bg-muted/60 h-1 w-10 rounded-full" />
        </div>

        <div className="mobile-map-preview-content overflow-y-auto overscroll-contain">
          {preview.type === 'album' ? (
            <AlbumPreviewContent item={preview.item} />
          ) : (
            <ClusterPreviewContent
              count={preview.count}
              items={preview.items}
            />
          )}
        </div>
      </section>
    </m.div>
  )
}
