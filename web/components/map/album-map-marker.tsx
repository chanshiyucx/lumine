'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { Marker, type MarkerInstance } from 'react-map-gl/maplibre'
import { ThumbnailImage } from '@/components/image'
import type { AlbumMapCover, MapItem } from '@/lib/album/map'
import { cn } from '@/lib/style'
import { AlbumPreviewCard } from './album-preview-card'
import { ClusterPreviewCard } from './cluster-preview-card'
import { clampMapLatitude } from './lib/map-viewport'
import { MapHoverPreview } from './map-hover-preview'
import { PhotoClusterPreviewCard } from './photo-cluster-preview-card'

const PINNED_MARKER_CLASS_NAME = 'border-love/80 ring-love/25 ring-2'

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
    <Marker
      ref={markerRef}
      longitude={longitude}
      latitude={clampMapLatitude(latitude)}
    >
      {children}
    </Marker>
  )
}

function renderLocationMarkerTrigger({
  cover,
  imageLoading,
  pinned,
  label,
}: {
  cover: AlbumMapCover
  imageLoading: 'eager' | 'lazy'
  pinned: boolean
  label: string
}) {
  return (
    <button
      type="button"
      className="group relative block size-11 cursor-pointer rounded-full"
      aria-label={label}
    >
      <span
        className={cn(
          'album-map-marker-visual bg-overlay relative block size-11 overflow-hidden rounded-full border-4 transition-[scale,border-color] duration-200 ease-out group-hover:scale-[1.08] group-data-[state=open]:scale-[1.08]',
          pinned ? PINNED_MARKER_CLASS_NAME : 'border-overlay',
        )}
      >
        <ThumbnailImage photo={cover} loading={imageLoading} />
        <span className="from-text/15 to-base/25 pointer-events-none absolute inset-0 bg-linear-to-br" />
      </span>
    </button>
  )
}

export function AlbumMarker({
  item,
  imageLoading,
  pinned,
  onPinnedChange,
}: {
  item: MapItem
  imageLoading: 'eager' | 'lazy'
  pinned: boolean
  onPinnedChange: (pinned: boolean) => void
}) {
  const cover = item.covers[0]
  const trigger = renderLocationMarkerTrigger({
    cover,
    imageLoading,
    pinned,
    label: `${item.label} ${item.kind} location`,
  })

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
  kind,
  canExpand,
  pinned,
  onPinnedChange,
}: {
  longitude: number
  latitude: number
  count: number
  items: MapItem[]
  imageLoading: 'eager' | 'lazy'
  onExpand?: () => void
  kind: MapItem['kind']
  canExpand: boolean
  pinned: boolean
  onPinnedChange?: (pinned: boolean) => void
}) {
  const terminalPhotoCluster = kind === 'photo' && !canExpand
  const size = Math.min(66, Math.max(50, 42 + Math.log2(count) * 7))
  const representativeCover = items[0].covers[0]
  const trigger = terminalPhotoCluster ? (
    renderLocationMarkerTrigger({
      cover: representativeCover,
      imageLoading,
      pinned,
      label: `${count} photos at this location`,
    })
  ) : (
    <button
      type="button"
      className="group relative block cursor-pointer rounded-full"
      style={{ width: size, height: size }}
      aria-label={`Zoom into ${count} ${kind === 'photo' ? 'photos' : 'albums'}`}
      onClick={(event) => {
        event.stopPropagation()
        onExpand?.()
      }}
    >
      <span className="album-map-marker-visual relative block size-full transition-transform duration-200 ease-out group-hover:scale-105">
        <span className="bg-text/10 absolute -inset-1 rounded-full" />
        <span className="bg-overlay border-overlay relative block size-full overflow-hidden rounded-full border-4">
          <ThumbnailImage photo={representativeCover} loading={imageLoading} />
          <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/40 text-sm font-bold">
            {count}
          </span>
        </span>
      </span>
    </button>
  )

  return (
    <MapMarker longitude={longitude} latitude={latitude}>
      <MapHoverPreview
        trigger={trigger}
        openDelay={terminalPhotoCluster ? 350 : 300}
        closeDelay={terminalPhotoCluster ? 120 : 150}
        pinned={pinned}
        onPinnedChange={terminalPhotoCluster ? onPinnedChange : undefined}
      >
        {kind === 'photo' ? (
          <PhotoClusterPreviewCard
            items={items}
            count={count}
            location={{ lat: latitude, lng: longitude }}
          />
        ) : (
          <ClusterPreviewCard count={count} items={items} />
        )}
      </MapHoverPreview>
    </MapMarker>
  )
}
