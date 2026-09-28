'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { type MapRef } from 'react-map-gl/maplibre'
import {
  MAP_MAX_ZOOM,
  MAP_PREVIEW_CAPACITY,
  MAP_STYLE_URL,
  WORLD_BOUNDS,
  type MapBounds,
} from '@/lib/map-config'
import type { AlbumMapItem, MapItem, PhotoMapItem } from '@/lib/map-items'
import { getPhotoPath } from '@/lib/route-paths'
import { getInitialFocusItems } from './lib/initial-map-focus'
import { prepareMapSelection } from './lib/map-selection'
import {
  clampMapLatitude,
  expandMapBounds,
  getMapMarkerImageLoading,
} from './lib/map-viewport'
import { MapControls } from './map-controls'
import { ClusterMarker, MapItemMarker } from './map-markers'
import { MapEmptyState, MapErrorState, MapLoadingState } from './map-states'

const MAP_LOAD_TIMEOUT_MS = 15_000

interface PhotoMapProps {
  albumItems: AlbumMapItem[]
  photos: PhotoMapItem[]
  photoId?: string
}

interface MapViewportState {
  bounds: MapBounds
  clusterBounds: MapBounds
  zoom: number
}

type MapLoadStatus = 'loading' | 'loaded' | 'failed'

type PinnedSelection =
  | { kind: 'item'; key: string }
  | {
      kind: 'photo-cluster'
      key: string
      items: PhotoMapItem[]
      location: { lng: number; lat: number }
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
      focusedPhoto ? { kind: 'item', key: focusedPhoto.key } : null,
    )
  const pinnedItemKey =
    pinnedSelection?.kind === 'item' ? pinnedSelection.key : null
  const pinnedPhotoCluster =
    pinnedSelection?.kind === 'photo-cluster' ? pinnedSelection : null
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
  const { selectedItem, clusterIndex } = useMemo(
    () => prepareMapSelection(albumItems, pinnedItemKey),
    [albumItems, pinnedItemKey],
  )
  const availablePhotos = useMemo(() => {
    if (!pinnedPhotoCluster) return photos

    const pinnedKeys = new Set(pinnedPhotoCluster.items.map((item) => item.key))
    return photos.filter((photo) => !pinnedKeys.has(photo.key))
  }, [photos, pinnedPhotoCluster])
  const photoSelection = useMemo(
    () => prepareMapSelection(availablePhotos, pinnedItemKey, MAP_MAX_ZOOM),
    [availablePhotos, pinnedItemKey],
  )
  const layers = useMemo(
    () => [
      { clusterIndex, selectedItem, kind: 'album' as const },
      { ...photoSelection, kind: 'photo' as const },
    ],
    [clusterIndex, selectedItem, photoSelection],
  )
  const clusters = useMemo(
    () =>
      layers.flatMap((layer) =>
        layer.clusterIndex
          .getClusters(viewport.clusterBounds, viewport.zoom)
          .map((feature) => ({ feature, layer })),
      ),
    [layers, viewport.clusterBounds, viewport.zoom],
  )

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
        {[
          ...clusters.map(({ feature, layer }) => {
            const [longitude, latitude] = feature.geometry.coordinates
            const imageLoading = getMapMarkerImageLoading(
              longitude,
              latitude,
              viewport.bounds,
            )

            if (!('item' in feature.properties)) {
              const { cluster_id: clusterId, point_count: pointCount } =
                feature.properties
              const photoItems =
                layer.kind === 'photo'
                  ? layer.clusterIndex
                      .getLeaves(clusterId, pointCount)
                      .map((leaf) => leaf.properties.item)
                  : null
              const clusterItems =
                photoItems ??
                layer.clusterIndex
                  .getLeaves(clusterId, MAP_PREVIEW_CAPACITY)
                  .map((leaf) => leaf.properties.item)

              const markerKey = `${layer.kind}-cluster-${viewport.zoom}-${feature.properties.minItemKey}`
              const expansionZoom = Math.min(
                MAP_MAX_ZOOM,
                layer.clusterIndex.getClusterExpansionZoom(clusterId),
              )
              const canExpand = expansionZoom > viewport.zoom
              const onPinnedChange =
                photoItems && !canExpand
                  ? () =>
                      setPinnedSelection({
                        kind: 'photo-cluster',
                        key: markerKey,
                        items: photoItems,
                        location: { lng: longitude, lat: latitude },
                      })
                  : undefined

              return (
                <ClusterMarker
                  key={markerKey}
                  longitude={longitude}
                  latitude={latitude}
                  count={pointCount}
                  kind={layer.kind}
                  pinned={false}
                  onPinnedChange={onPinnedChange}
                  canExpand={canExpand}
                  items={clusterItems}
                  imageLoading={imageLoading}
                  onExpand={
                    canExpand
                      ? () =>
                          handleClusterExpand(expansionZoom, [
                            longitude,
                            latitude,
                          ])
                      : undefined
                  }
                />
              )
            }

            const item = feature.properties.item

            return (
              <MapItemMarker
                key={item.key}
                item={item}
                imageLoading={imageLoading}
                pinned={false}
                onPinnedChange={(pinned) => {
                  setPinnedSelection(
                    pinned ? { kind: 'item', key: item.key } : null,
                  )
                }}
              />
            )
          }),
          ...layers.flatMap(({ selectedItem }) =>
            selectedItem
              ? [
                  <MapItemMarker
                    key={selectedItem.key}
                    item={selectedItem}
                    imageLoading={getMapMarkerImageLoading(
                      selectedItem.location.lng,
                      selectedItem.location.lat,
                      viewport.bounds,
                    )}
                    pinned
                    onPinnedChange={(pinned) => {
                      setPinnedSelection(
                        pinned ? { kind: 'item', key: selectedItem.key } : null,
                      )
                    }}
                  />,
                ]
              : [],
          ),
          ...(pinnedPhotoCluster
            ? [
                <ClusterMarker
                  key={pinnedPhotoCluster.key}
                  longitude={pinnedPhotoCluster.location.lng}
                  latitude={pinnedPhotoCluster.location.lat}
                  count={pinnedPhotoCluster.items.length}
                  kind="photo"
                  pinned
                  onPinnedChange={(pinned) => {
                    if (!pinned) setPinnedSelection(null)
                  }}
                  canExpand={false}
                  items={pinnedPhotoCluster.items}
                  imageLoading={getMapMarkerImageLoading(
                    pinnedPhotoCluster.location.lng,
                    pinnedPhotoCluster.location.lat,
                    viewport.bounds,
                  )}
                />,
              ]
            : []),
        ]}
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
