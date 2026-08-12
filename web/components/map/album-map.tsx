'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { type MapRef } from 'react-map-gl/maplibre'
import Supercluster from 'supercluster'
import { AlbumMarker, ClusterMarker } from './album-map-marker'
import type { AlbumMapItem } from './lib/album-map-data'
import { getInitialFocusItems } from './lib/initial-map-focus'
import {
  CLUSTER_PREVIEW_CAPACITY,
  CLUSTER_RADIUS,
  MAX_CLUSTER_ZOOM,
  WORLD_BOUNDS,
  type MapBounds,
} from './lib/map-config'
import { expandMapBounds, getMapMarkerImageLoading } from './lib/map-viewport'
import { MapControls } from './map-controls'
import { MapEmptyState, MapErrorState, MapLoadingState } from './map-states'

const MAP_STYLE_URL =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const MAP_LOAD_TIMEOUT_MS = 15_000

interface AlbumPointProperties {
  item: AlbumMapItem
}

interface AlbumMapProps {
  items: AlbumMapItem[]
}

interface MapViewportState {
  bounds: MapBounds
  clusterBounds: MapBounds
  zoom: number
}

type MapLoadStatus = 'loading' | 'loaded' | 'failed'

function makeClusterIndex(items: AlbumMapItem[]) {
  const points: Supercluster.PointFeature<AlbumPointProperties>[] = items.map(
    (item) => ({
      type: 'Feature',
      properties: { item },
      geometry: {
        type: 'Point',
        coordinates: [item.location.lng, item.location.lat],
      },
    }),
  )

  return new Supercluster<AlbumPointProperties>({
    radius: CLUSTER_RADIUS,
    maxZoom: MAX_CLUSTER_ZOOM,
  }).load(points)
}

function getMapBounds(map: MapRef): MapBounds {
  const bounds = map.getBounds()

  return [
    bounds.getWest(),
    bounds.getSouth(),
    bounds.getEast(),
    bounds.getNorth(),
  ]
}

function fitMapToItems(map: MapRef, items: AlbumMapItem[], animated: boolean) {
  if (items.length === 0) return

  const longitudes = items.map((item) => item.location.lng)
  const latitudes = items.map((item) => item.location.lat)
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

export function AlbumMap({ items }: AlbumMapProps) {
  const mapRef = useRef<MapRef>(null)
  const [viewport, setViewport] = useState<MapViewportState>({
    bounds: WORLD_BOUNDS,
    clusterBounds: WORLD_BOUNDS,
    zoom: 1,
  })
  const [loadStatus, setLoadStatus] = useState<MapLoadStatus>('loading')
  const [mapInstanceKey, setMapInstanceKey] = useState(0)
  const [showingAll, setShowingAll] = useState(false)
  const [pinnedAlbumKey, setPinnedAlbumKey] = useState<string | null>(null)
  const initialFocusItems = useMemo(() => getInitialFocusItems(items), [items])
  const clusterIndex = useMemo(() => makeClusterIndex(items), [items])
  const clusters = useMemo(
    () => clusterIndex.getClusters(viewport.clusterBounds, viewport.zoom),
    [clusterIndex, viewport.clusterBounds, viewport.zoom],
  )

  useEffect(() => {
    if (loadStatus !== 'loading' || items.length === 0) return

    const timeoutId = window.setTimeout(() => {
      setLoadStatus('failed')
    }, MAP_LOAD_TIMEOUT_MS)

    return () => window.clearTimeout(timeoutId)
  }, [items.length, loadStatus])

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

    fitMapToItems(map, initialFocusItems, false)
    setLoadStatus('loaded')
    setShowingAll(false)
  }

  const retryMap = () => {
    setLoadStatus('loading')
    setMapInstanceKey((currentKey) => currentKey + 1)
  }

  const handleClusterExpand = (
    clusterId: number,
    center: [longitude: number, latitude: number],
  ) => {
    setPinnedAlbumKey(null)

    const map = mapRef.current
    if (!map) return

    map.easeTo({
      center,
      zoom: clusterIndex.getClusterExpansionZoom(clusterId),
      duration: 700,
    })
  }

  const handleToggleExtent = () => {
    const map = mapRef.current
    if (!map) return

    setPinnedAlbumKey(null)

    if (showingAll) {
      fitMapToItems(map, initialFocusItems, true)
      setShowingAll(false)
      return
    }

    fitMapToItems(map, items, true)
    setShowingAll(initialFocusItems.length < items.length)
  }

  return (
    <main className="album-map relative h-svh overflow-hidden">
      <Map
        key={mapInstanceKey}
        ref={mapRef}
        initialViewState={{ longitude: 20, latitude: 42, zoom: 1 }}
        minZoom={1}
        maxZoom={17}
        mapStyle={MAP_STYLE_URL}
        projection={{ type: 'mercator' }}
        attributionControl={false}
        onClick={() => setPinnedAlbumKey(null)}
        onLoad={handleLoad}
        onError={() => {
          if (loadStatus === 'loading') setLoadStatus('failed')
        }}
        onMoveEnd={syncMapState}
      >
        {clusters.map((feature) => {
          const [longitude, latitude] = feature.geometry.coordinates
          const imageLoading = getMapMarkerImageLoading(
            longitude,
            latitude,
            viewport.bounds,
          )

          if (
            'cluster' in feature.properties &&
            feature.properties.cluster === true
          ) {
            const { cluster_id: clusterId, point_count: pointCount } =
              feature.properties
            const clusterItems = clusterIndex
              .getLeaves(clusterId, CLUSTER_PREVIEW_CAPACITY)
              .map((leaf) => leaf.properties.item)

            return (
              <ClusterMarker
                key={`cluster-${clusterId}`}
                longitude={longitude}
                latitude={latitude}
                count={pointCount}
                items={clusterItems}
                imageLoading={imageLoading}
                onExpand={() =>
                  handleClusterExpand(clusterId, [longitude, latitude])
                }
              />
            )
          }

          const item = feature.properties.item

          return (
            <AlbumMarker
              key={item.key}
              item={item}
              imageLoading={imageLoading}
              pinned={pinnedAlbumKey === item.key}
              onPinnedChange={(pinned) => {
                setPinnedAlbumKey(pinned ? item.key : null)
              }}
            />
          )
        })}
      </Map>

      {items.length > 0 && (
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

      {loadStatus === 'loaded' && items.length === 0 && <MapEmptyState />}
    </main>
  )
}
