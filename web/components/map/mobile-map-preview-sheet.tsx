'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { cn } from '@/lib/style'
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
}: {
  preview: MobileMapPreview
  onDismiss: () => void
}) {
  const dragSessionRef = useRef<DragSession | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onDismiss])

  const label =
    preview.type === 'album'
      ? `${preview.item.label} album preview`
      : `${preview.count} albums in this area`

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    dragSessionRef.current = {
      pointerId: event.pointerId,
      startTime: performance.now(),
      startY: event.clientY,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
  }

  const updateDrag = (event: PointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current
    if (!session || event.pointerId !== session.pointerId) return

    setDragOffset(Math.max(0, event.clientY - session.startY))
  }

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current
    if (!session || event.pointerId !== session.pointerId) return

    const distance = Math.max(0, event.clientY - session.startY)
    const elapsed = Math.max(performance.now() - session.startTime, 1)

    dragSessionRef.current = null
    setIsDragging(false)
    if (shouldDismissMobilePreview({ distance, elapsedMs: elapsed })) {
      onDismiss()
      return
    }

    setDragOffset(0)
  }

  const cancelDrag = () => {
    dragSessionRef.current = null
    setIsDragging(false)
    setDragOffset(0)
  }

  return (
    <section
      aria-label={label}
      data-mobile-map-preview={preview.type}
      className={cn(
        'mobile-map-preview-sheet border-text/15 bg-base/97 fixed right-2 bottom-0 left-2 z-50 mx-auto max-h-[min(70svh,34rem)] max-w-lg overflow-hidden rounded-t-3xl border border-b-0 shadow-2xl backdrop-blur-[120px]',
        !isDragging && 'transition-transform duration-200 ease-out',
      )}
      style={
        dragOffset > 0
          ? { transform: `translate3d(0, ${dragOffset}px, 0)` }
          : undefined
      }
    >
      <div
        className="flex h-7 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
        aria-hidden
        onPointerDown={startDrag}
        onPointerMove={updateDrag}
        onPointerUp={finishDrag}
        onPointerCancel={cancelDrag}
      >
        <span className="bg-text/25 h-1 w-10 rounded-full" />
      </div>

      <div className="mobile-map-preview-content overflow-y-auto overscroll-contain">
        {preview.type === 'album' ? (
          <AlbumPreviewContent item={preview.item} />
        ) : (
          <ClusterPreviewContent count={preview.count} items={preview.items} />
        )}
      </div>
    </section>
  )
}
