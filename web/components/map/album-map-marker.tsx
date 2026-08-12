'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { Marker, type MarkerInstance } from 'react-map-gl/maplibre'
import { ThumbnailImage } from '@/components/photo'
import { cn } from '@/lib/style'
import { AlbumPreviewCard } from './album-preview-card'
import { ClusterPreviewCard } from './cluster-preview-card'
import type { AlbumMapItem } from './lib/album-map-data'
import { MapHoverPreview } from './map-hover-preview'

interface MapMarkerProps {
  longitude: number
  latitude: number
  children: ReactNode
}

function MapMarker({ longitude, latitude, children }: MapMarkerProps) {
  const markerRef = useRef<MarkerInstance>(null)

  useEffect(() => {
    const element = markerRef.current?.getElement()
    if (!element) return

    element.removeAttribute('aria-label')
    element.removeAttribute('role')
  }, [])

  return (
    <Marker ref={markerRef} longitude={longitude} latitude={latitude}>
      {children}
    </Marker>
  )
}

export function AlbumMarker({
  item,
  imageLoading,
  pinned,
  onPinnedChange,
}: {
  item: AlbumMapItem
  imageLoading: 'eager' | 'lazy'
  pinned: boolean
  onPinnedChange: (pinned: boolean) => void
}) {
  const cover = item.covers[0]
  const trigger = (
    <button
      type="button"
      className="group focus-visible:outline-iris relative block size-11 cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-3"
      aria-label={`${item.label} album location`}
    >
      <span
        className={cn(
          'bg-overlay relative block size-11 overflow-hidden rounded-full border-2 shadow-xl transition-[scale,border-color,box-shadow] duration-200 ease-out group-hover:scale-[1.08] group-data-[state=open]:scale-[1.08]',
          pinned ? 'border-iris/80 ring-iris/25 ring-2' : 'border-subtle/50',
        )}
      >
        <ThumbnailImage photo={cover} loading={imageLoading} />
        <span className="from-text/15 to-base/25 pointer-events-none absolute inset-0 bg-linear-to-br" />
      </span>
    </button>
  )

  return (
    <MapMarker longitude={item.location.lng} latitude={item.location.lat}>
      <MapHoverPreview
        trigger={trigger}
        openDelay={350}
        closeDelay={120}
        pinned={pinned}
        onPinnedChange={onPinnedChange}
      >
        <AlbumPreviewCard item={item} />
      </MapHoverPreview>
    </MapMarker>
  )
}

export function ClusterMarker({
  longitude,
  latitude,
  count,
  items,
  imageLoading,
  onExpand,
}: {
  longitude: number
  latitude: number
  count: number
  items: AlbumMapItem[]
  imageLoading: 'eager' | 'lazy'
  onExpand: () => void
}) {
  const size = Math.min(66, Math.max(50, 42 + Math.log2(count) * 7))
  const representativeCover = items[0].covers[0]
  const trigger = (
    <button
      type="button"
      className="group focus-visible:outline-iris relative block cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-3"
      style={{ width: size, height: size }}
      aria-label={`Zoom into ${count} albums`}
      onClick={(event) => {
        event.stopPropagation()
        onExpand()
      }}
    >
      <span className="bg-iris/20 absolute -inset-1.5 rounded-full" />
      <span className="border-subtle/50 bg-overlay relative block size-full overflow-hidden rounded-full border-2 shadow-2xl transition-transform duration-200 ease-out group-hover:scale-105">
        <ThumbnailImage photo={representativeCover} loading={imageLoading} />
        <span className="from-base/25 to-iris/65 pointer-events-none absolute inset-0 bg-linear-to-br" />
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm font-bold drop-shadow-lg">
          {count}
        </span>
      </span>
    </button>
  )

  return (
    <MapMarker longitude={longitude} latitude={latitude}>
      <MapHoverPreview trigger={trigger} openDelay={300} closeDelay={150}>
        <ClusterPreviewCard count={count} items={items} />
      </MapHoverPreview>
    </MapMarker>
  )
}
