import { useEffect, useRef, type ReactNode } from 'react'
import { Marker, type MarkerInstance } from 'react-map-gl/maplibre'
import {
  ThumbnailImage,
  type ImageLoading,
} from '@/components/image/thumbnail-image'
import type {
  AlbumMapItem,
  MapCover,
  MapItem,
  PhotoMapItem,
} from '@/lib/map-types'
import { clamp } from '@/lib/math'
import { cn } from '@/lib/style'
import { AlbumClusterPreviewCard } from './album-cluster-preview-card'
import type {
  ExpandableClusterMarkerData,
  MapMarkerData,
  PinnedSelection,
  TerminalPhotoClusterMarkerData,
} from './lib/map-clustering'
import { clampMapLatitude, type MapCenter } from './lib/map-viewport'
import { MapHoverPreview } from './map-hover-preview'
import { MapItemPreviewCard } from './map-item-preview-card'
import { PhotoClusterPreviewCard } from './photo-cluster-preview-card'

const PINNED_MARKER_CLASS_NAME = 'border-love/80 ring-love/25 ring-2'

// Location markers (single items and terminal photo clusters) share one feel.
const LOCATION_PREVIEW_DELAYS = { openDelay: 350, closeDelay: 120 }
const CLUSTER_PREVIEW_DELAYS = { openDelay: 300, closeDelay: 150 }

interface MapMarkerProps {
  longitude: number
  latitude: number
  children: ReactNode
}

function MapMarker({ longitude, latitude, children }: MapMarkerProps) {
  const markerRef = useRef<MarkerInstance>(null)

  // MapLibre gives the marker element role="button" and aria-label="Map marker",
  // which would wrap our own labelled button in a second, generic one.
  useEffect(() => {
    const element = markerRef.current?.getElement()
    if (!element) {
      return
    }

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

interface LocationMarkerTriggerOptions {
  cover: MapCover
  imageLoading: ImageLoading
  pinned: boolean
  label: string
}

function renderLocationMarkerTrigger({
  cover,
  imageLoading,
  pinned,
  label,
}: LocationMarkerTriggerOptions) {
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

interface MapItemMarkerProps {
  item: MapItem
  imageLoading: ImageLoading
  pinned: boolean
  onPinnedChange: (pinned: boolean) => void
}

function MapItemMarker({
  item,
  imageLoading,
  pinned,
  onPinnedChange,
}: MapItemMarkerProps) {
  const trigger = renderLocationMarkerTrigger({
    cover: item.covers[0],
    imageLoading,
    pinned,
    label: `${item.label} ${item.kind} location`,
  })

  return (
    <MapMarker longitude={item.location.lng} latitude={item.location.lat}>
      <MapHoverPreview
        trigger={trigger}
        {...LOCATION_PREVIEW_DELAYS}
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
  const { location, count, imageLoading } = props
  const representativeCover = props.items[0].covers[0]
  const preview =
    props.kind === 'photo' ? (
      <PhotoClusterPreviewCard items={props.items} location={location} />
    ) : (
      <AlbumClusterPreviewCard count={count} items={props.items} />
    )

  if (!props.canExpand) {
    const trigger = renderLocationMarkerTrigger({
      cover: representativeCover,
      imageLoading,
      pinned: props.pinned,
      label: `${count} photos at this location`,
    })

    return (
      <MapMarker longitude={location.lng} latitude={location.lat}>
        <MapHoverPreview
          trigger={trigger}
          {...LOCATION_PREVIEW_DELAYS}
          pinned={props.pinned}
          onPinnedChange={props.onPinnedChange}
        >
          {preview}
        </MapHoverPreview>
      </MapMarker>
    )
  }

  const size = clamp(42 + Math.log2(count) * 7, 50, 66)
  const trigger = (
    <button
      type="button"
      className="group relative block cursor-pointer rounded-full"
      style={{ width: size, height: size }}
      aria-label={`Zoom into ${count} ${props.kind === 'photo' ? 'photos' : 'albums'}`}
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

  return (
    <MapMarker longitude={location.lng} latitude={location.lat}>
      <MapHoverPreview trigger={trigger} {...CLUSTER_PREVIEW_DELAYS}>
        {preview}
      </MapHoverPreview>
    </MapMarker>
  )
}

interface MapMarkersProps {
  markers: readonly MapMarkerData[]
  onPinnedChange: (selection: PinnedSelection | null) => void
  onClusterExpand: (zoom: number, center: MapCenter) => void
}

export function MapMarkers({
  markers,
  onPinnedChange,
  onClusterExpand,
}: MapMarkersProps) {
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
