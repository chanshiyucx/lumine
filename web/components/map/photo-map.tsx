'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { type MapRef } from 'react-map-gl/maplibre'
import {
  MAP_MAX_ZOOM,
  MAP_STYLE_URL,
  WORLD_BOUNDS,
  type MapBounds,
} from '@/lib/map-config'
import type { AlbumMapItem, MapItem, PhotoMapItem } from '@/lib/map-types'
import { getPhotoPath } from '@/lib/route-paths'
import { useMapClusters } from './hooks/use-map-clusters'
import { getInitialFocusItems } from './lib/initial-map-focus'
import type { PinnedSelection } from './lib/map-clustering'
import {
  clampMapLatitude,
  expandMapBounds,
  type MapViewportState,
} from './lib/map-viewport'
import { MapControls } from './map-controls'
import { MapMarkers } from './map-markers'
import { MapEmptyState, MapErrorState, MapLoadingState } from './map-states'

const MAP_LOAD_TIMEOUT_MS = 15_000

interface PhotoMapProps {
  albumItems: AlbumMapItem[]
  photos: PhotoMapItem[]
  photoId?: string
}

type MapLoadStatus = 'loading' | 'loaded' | 'failed'

function getMapBounds(map: MapRef): MapBounds {
  const bounds = map.getBounds()

  return [
    bounds.getWest(),
    bounds.getSouth(),
    bounds.getEast(),
    bounds.getNorth(),
  ]
}

function fitMapToItems(map: MapRef, items: MapItem[], animated: boolean) {
  if (items.length === 0) return

  const longitudes = items.map((item) => item.location.lng)
  const latitudes = items.map((item) => clampMapLatitude(item.location.lat))
  const container = map.getContainer()
  const horizontalPadding = Math.max(container.offsetWidth * 0.06, 40)
  const verticalPadding = Math.max(container.offsetHeight * 0.1, 64)

  map.fitBounds(
    [
      [Math.min(...longitudes), Math.min(...latitudes)],
      [Math.max(...longitudes), Math.max(...latitudes)],
    ],
    {
      padding: {
        top: Math.max(verticalPadding, 88),
        right: horizontalPadding,
        bottom: verticalPadding,
        left: horizontalPadding,
      },
      duration: animated ? 900 : 0,
      maxZoom: 10,
    },
  )
}

export function PhotoMap({ albumItems, photos, photoId }: PhotoMapProps) {
  const mapRef = useRef<MapRef>(null)
  const targetHref = photoId ? getPhotoPath(photoId) : undefined
  const focusedPhoto = targetHref
    ? photos.find((photo) => photo.href === targetHref)
    : undefined
  const [viewport, setViewport] = useState<MapViewportState>({
    bounds: WORLD_BOUNDS,
    clusterBounds: WORLD_BOUNDS,
    zoom: 1,
  })
  const [loadStatus, setLoadStatus] = useState<MapLoadStatus>('loading')
  const [mapInstanceKey, setMapInstanceKey] = useState(0)
  const [showingAll, setShowingAll] = useState(false)
  const [pinnedSelection, setPinnedSelection] =
    useState<PinnedSelection | null>(
      focusedPhoto ? { kind: 'photo', key: focusedPhoto.key } : null,
    )
  const allItems = useMemo(
    () => [...albumItems, ...photos],
    [albumItems, photos],
  )
  const initialFocusItems = useMemo(
    () =>
      getInitialFocusItems<MapItem>(
        albumItems.length > 0 ? albumItems : photos,
      ),
    [albumItems, photos],
  )
  const markers = useMapClusters({
    albumItems,
    photos,
    viewport,
    pinnedSelection,
  })

  useEffect(() => {
    if (loadStatus !== 'loading' || allItems.length === 0) return

    const timeoutId = window.setTimeout(() => {
      setLoadStatus('failed')
    }, MAP_LOAD_TIMEOUT_MS)

    return () => window.clearTimeout(timeoutId)
  }, [allItems.length, loadStatus])

  const syncMapState = () => {
    const map = mapRef.current
    if (!map) return

    const bounds = getMapBounds(map)
    setViewport({
      bounds,
      clusterBounds: expandMapBounds(bounds),
      zoom: Math.floor(map.getZoom()),
    })
  }

  const handleLoad = () => {
    const map = mapRef.current
    if (!map) return

    if (focusedPhoto) {
      map.jumpTo({
        center: [
          focusedPhoto.location.lng,
          clampMapLatitude(focusedPhoto.location.lat),
        ],
        zoom: 15,
      })
    } else {
      fitMapToItems(map, initialFocusItems, false)
    }
    setLoadStatus('loaded')
    setShowingAll(false)
  }

  const retryMap = () => {
    setLoadStatus('loading')
    setMapInstanceKey((currentKey) => currentKey + 1)
  }

  const handleClusterExpand = (
    zoom: number,
    center: [longitude: number, latitude: number],
  ) => {
    setPinnedSelection(null)

    const map = mapRef.current
    if (!map) return

    map.easeTo({
      center,
      zoom,
      duration: 700,
    })
  }

  const handleToggleExtent = () => {
    const map = mapRef.current
    if (!map) return

    setPinnedSelection(null)

    if (showingAll) {
      fitMapToItems(map, initialFocusItems, true)
      setShowingAll(false)
      return
    }

    fitMapToItems(map, allItems, true)
    setShowingAll(initialFocusItems.length < allItems.length)
  }

  return (
    <main className="photo-map relative h-svh overflow-hidden">
      <Map
        key={mapInstanceKey}
        ref={mapRef}
        initialViewState={
          focusedPhoto
            ? {
                longitude: focusedPhoto.location.lng,
                latitude: clampMapLatitude(focusedPhoto.location.lat),
                zoom: 15,
              }
            : { longitude: 20, latitude: 42, zoom: 1 }
        }
        minZoom={1}
        maxZoom={MAP_MAX_ZOOM}
        mapStyle={MAP_STYLE_URL}
        projection={{ type: 'mercator' }}
        attributionControl={false}
        onClick={() => setPinnedSelection(null)}
        onLoad={handleLoad}
        onError={() => {
          if (loadStatus === 'loading') setLoadStatus('failed')
        }}
        onMoveEnd={syncMapState}
      >
        <MapMarkers
          markers={markers}
          onPinnedChange={setPinnedSelection}
          onClusterExpand={handleClusterExpand}
        />
      </Map>

      {allItems.length > 0 && (
        <MapControls
          showingAll={showingAll}
          onZoomIn={() => mapRef.current?.zoomIn({ duration: 250 })}
          onZoomOut={() => mapRef.current?.zoomOut({ duration: 250 })}
          onToggleExtent={handleToggleExtent}
        />
      )}

      {loadStatus === 'loading' && (
        <MapLoadingState className="absolute inset-0 z-30" />
      )}

      {loadStatus === 'failed' && (
        <MapErrorState className="absolute inset-0 z-30" onRetry={retryMap} />
      )}

      {loadStatus === 'loaded' && allItems.length === 0 && <MapEmptyState />}
    </main>
  )
}
