'use client'

import { MapPinned } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { Marker, type MarkerInstance } from 'react-map-gl/maplibre'
import { cn } from '@/lib/style'
import { AlbumMapCoverImage } from './album-map-cover'
import { AlbumPreviewCard } from './album-preview-card'
import { ClusterPreviewCard } from './cluster-preview-card'
import type { AlbumMapItem } from './lib/album-map-data'
import { MapHoverPreview } from './map-hover-preview'

interface MapMarkerProps {
  longitude: number
  latitude: number
  label: string
  onActivate?: () => void
  children: ReactNode
}

function MapMarker({
  longitude,
  latitude,
  label,
  onActivate,
  children,
}: MapMarkerProps) {
  const markerRef = useRef<MarkerInstance>(null)
  const isInteractive = onActivate !== undefined

  useEffect(() => {
    const element = markerRef.current?.getElement()
    if (!element) return

    element.setAttribute('aria-label', label)
    if (!isInteractive) {
      element.setAttribute('role', 'img')
      element.removeAttribute('tabindex')
      return
    }

    element.setAttribute('role', 'button')
    element.setAttribute('tabindex', '0')

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return

      event.preventDefault()
      element.click()
    }

    element.addEventListener('keydown', handleKeyDown)
    return () => {
      element.removeEventListener('keydown', handleKeyDown)
      element.removeAttribute('tabindex')
    }
  }, [isInteractive, label])

  return (
    <Marker
      ref={markerRef}
      longitude={longitude}
      latitude={latitude}
      anchor="center"
      onClick={
        onActivate
          ? (event) => {
              event.originalEvent.stopPropagation()
              onActivate()
            }
          : undefined
      }
    >
      {children}
    </Marker>
  )
}

export function AlbumMarker({
  item,
  canHover,
  imageLoading,
  onPreview,
  pinned,
  onPinnedChange,
}: {
  item: AlbumMapItem
  canHover: boolean
  imageLoading: 'eager' | 'lazy'
  onPreview: () => void
  pinned: boolean
  onPinnedChange: (pinned: boolean) => void
}) {
  const cover = item.covers[0]
  const trigger = (
    <span
      className="group focus-visible:outline-iris relative block size-11 cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-3"
      aria-hidden
      onPointerUp={(event) => {
        if (canHover && event.pointerType !== 'mouse') onPreview()
      }}
    >
      <span
        className={cn(
          'bg-overlay relative block size-11 overflow-hidden rounded-full border-2 shadow-xl transition-[scale,border-color,box-shadow] duration-200 ease-out group-hover:scale-[1.08] group-data-[state=open]:scale-[1.08]',
          pinned ? 'border-iris/80 ring-iris/25 ring-2' : 'border-subtle/50',
        )}
      >
        {cover ? (
          <AlbumMapCoverImage cover={cover} alt="" loading={imageLoading} />
        ) : (
          <MapPinned className="text-subtle absolute inset-0 m-auto size-4" />
        )}
        <span className="from-text/15 to-base/25 pointer-events-none absolute inset-0 bg-linear-to-br" />
      </span>
    </span>
  )

  return (
    <MapMarker
      longitude={item.location.lng}
      latitude={item.location.lat}
      label={`${item.label} album location`}
      onActivate={canHover ? undefined : onPreview}
    >
      {canHover ? (
        <MapHoverPreview
          trigger={trigger}
          openDelay={350}
          closeDelay={120}
          pinned={pinned}
          onPinnedChange={onPinnedChange}
        >
          <AlbumPreviewCard item={item} />
        </MapHoverPreview>
      ) : (
        trigger
      )}
    </MapMarker>
  )
}

export function ClusterMarker({
  longitude,
  latitude,
  count,
  items,
  canHover,
  imageLoading,
  onExpand,
}: {
  longitude: number
  latitude: number
  count: number
  items: AlbumMapItem[]
  canHover: boolean
  imageLoading: 'eager' | 'lazy'
  onExpand: () => void
}) {
  const size = Math.min(66, Math.max(50, 42 + Math.log2(count) * 7))
  const representativeCover = items[0]?.covers[0]
  const trigger = (
    <span
      className="group focus-visible:outline-iris relative block cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-3"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className="bg-iris/20 absolute -inset-1.5 rounded-full" />
      <span className="border-subtle/50 bg-overlay relative block size-full overflow-hidden rounded-full border-2 shadow-2xl transition-transform duration-200 ease-out group-hover:scale-105">
        {representativeCover && (
          <AlbumMapCoverImage
            cover={representativeCover}
            loading={imageLoading}
          />
        )}
        <span className="from-base/25 to-iris/65 pointer-events-none absolute inset-0 bg-linear-to-br" />
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm font-bold drop-shadow-lg">
          {count}
        </span>
      </span>
    </span>
  )

  return (
    <MapMarker
      longitude={longitude}
      latitude={latitude}
      label={`Zoom into ${count} albums`}
      onActivate={onExpand}
    >
      {canHover ? (
        <MapHoverPreview trigger={trigger} openDelay={300} closeDelay={150}>
          <ClusterPreviewCard count={count} items={items} />
        </MapHoverPreview>
      ) : (
        trigger
      )}
    </MapMarker>
  )
}
