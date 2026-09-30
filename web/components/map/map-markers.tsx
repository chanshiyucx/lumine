'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { Marker, type MarkerInstance } from 'react-map-gl/maplibre'
import { ThumbnailImage } from '@/components/image'
import type {
  AlbumMapItem,
  MapCover,
  MapItem,
  PhotoMapItem,
} from '@/lib/map-types'
import { cn } from '@/lib/style'
import { AlbumClusterPreviewCard } from './album-cluster-preview-card'
import type {
  ExpandableClusterMarkerData,
  MapMarkerData,
  PinnedSelection,
  TerminalPhotoClusterMarkerData,
} from './lib/map-clustering'
import { clampMapLatitude } from './lib/map-viewport'
import { MapHoverPreview, type MapHoverPreviewProps } from './map-hover-preview'
import { MapItemPreviewCard } from './map-item-preview-card'
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
      className="font-sans"
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
  cover: MapCover
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
          'map-marker-visual bg-overlay relative block size-11 overflow-hidden rounded-full border-4 transition-[scale,border-color] duration-200 ease-out group-hover:scale-[1.08] group-data-[state=open]:scale-[1.08]',
          pinned ? PINNED_MARKER_CLASS_NAME : 'border-overlay',
        )}
      >
        <ThumbnailImage photo={cover} loading={imageLoading} />
        <span className="from-text/15 to-base/25 pointer-events-none absolute inset-0 bg-linear-to-br" />
      </span>
    </button>
  )
}

function MapItemMarker({
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
        <MapItemPreviewCard item={item} />
      </MapHoverPreview>
    </MapMarker>
  )
}

type MapClusterMarkerProps =
  | (Omit<ExpandableClusterMarkerData<AlbumMapItem>, 'type' | 'key'> & {
      onExpand: () => void
    })
  | (Omit<ExpandableClusterMarkerData<PhotoMapItem>, 'type' | 'key'> & {
      onExpand: () => void
    })
  | (Omit<TerminalPhotoClusterMarkerData, 'type' | 'key'> & {
      onPinnedChange: (pinned: boolean) => void
    })

function MapClusterMarker(props: MapClusterMarkerProps) {
  const { location, count, items, imageLoading, kind, pinned } = props
  const terminalPhotoCluster = !props.canExpand
  const size = Math.min(66, Math.max(50, 42 + Math.log2(count) * 7))
  const representativeCover = items[0].covers[0]
  const trigger = !props.canExpand ? (
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
        props.onExpand()
      }}
    >
      <span className="map-marker-visual relative block size-full transition-transform duration-200 ease-out group-hover:scale-105">
        <span className="bg-text/10 absolute -inset-1 rounded-full" />
        <span className="bg-overlay border-overlay relative block size-full overflow-hidden rounded-full border-4">
          <ThumbnailImage photo={representativeCover} loading={imageLoading} />
          <span className="bg-base/50 pointer-events-none absolute inset-0 grid place-items-center text-sm font-semibold">
            {count}
          </span>
        </span>
      </span>
    </button>
  )

  const previewProps = {
    trigger,
    openDelay: terminalPhotoCluster ? 350 : 300,
    closeDelay: terminalPhotoCluster ? 120 : 150,
    children:
      props.kind === 'photo' ? (
        <PhotoClusterPreviewCard items={props.items} location={location} />
      ) : (
        <AlbumClusterPreviewCard count={count} items={props.items} />
      ),
  }
  const hoverProps: MapHoverPreviewProps = props.canExpand
    ? previewProps
    : {
        ...previewProps,
        pinned: props.pinned,
        onPinnedChange: props.onPinnedChange,
      }

  return (
    <MapMarker longitude={location.lng} latitude={location.lat}>
      <MapHoverPreview {...hoverProps} />
    </MapMarker>
  )
}

export function MapMarkers({
  markers,
  onPinnedChange,
  onClusterExpand,
}: {
  markers: readonly MapMarkerData[]
  onPinnedChange: (selection: PinnedSelection | null) => void
  onClusterExpand: (
    zoom: number,
    center: [longitude: number, latitude: number],
  ) => void
}) {
  // Keep every marker in one flat list so pinning preserves its component identity.
  return markers.map((marker) => {
    if (marker.type === 'item') {
      const { item } = marker
      return (
        <MapItemMarker
          key={marker.key}
          item={item}
          imageLoading={marker.imageLoading}
          pinned={marker.pinned}
          onPinnedChange={(pinned) => {
            onPinnedChange(pinned ? { kind: item.kind, key: item.key } : null)
          }}
        />
      )
    }

    const { key, ...data } = marker
    return data.canExpand ? (
      <MapClusterMarker
        key={key}
        {...data}
        onExpand={() =>
          onClusterExpand(data.expansionZoom, [
            data.location.lng,
            data.location.lat,
          ])
        }
      />
    ) : (
      <MapClusterMarker
        key={key}
        {...data}
        onPinnedChange={(pinned) => {
          onPinnedChange(
            pinned
              ? {
                  kind: 'photo-cluster',
                  key,
                  items: data.items,
                  location: data.location,
                }
              : null,
          )
        }}
      />
    )
  })
}
