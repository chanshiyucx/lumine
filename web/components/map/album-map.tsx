'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Map, { type MapRef } from 'react-map-gl/maplibre'
import Supercluster from 'supercluster'
import { useMediaQuery } from '@/hooks/use-media-query'
import { AlbumMarker, ClusterMarker } from './album-map-marker'
import type { AlbumMapItem } from './lib/album-map-data'
import { getInitialFocusItems } from './lib/initial-map-focus'
import {
  CLUSTER_RADIUS,
  MAX_CLUSTER_ZOOM,
  WORLD_BOUNDS,
  type MapBounds,
} from './lib/map-config'
import { shouldPreviewClusterOnTouch } from './lib/map-preview-interaction'
import { expandMapBounds, getMapMarkerImageLoading } from './lib/map-viewport'
import { MapControls } from './map-controls'
import { MapErrorState, MapLoadingState } from './map-loading-state'
import {
  MobileMapPreviewSheet,
  type MobileMapPreview,
} from './mobile-map-preview-sheet'

const MAP_STYLE_URL =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const MAP_HOVER_PREVIEW_QUERY =
  '(min-width: 768px) and (hover: hover) and (pointer: fine)'
const MOBILE_PREVIEW_MAP_GAP = 16
const MAP_LOAD_TIMEOUT_MS = 15_000
const EMPTY_PADDING = { top: 0, right: 0, bottom: 0, left: 0 }

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
  const canHover = useMediaQuery(MAP_HOVER_PREVIEW_QUERY)
  const [viewport, setViewport] = useState<MapViewportState>({
    bounds: WORLD_BOUNDS,
    clusterBounds: WORLD_BOUNDS,
    zoom: 1,
  })
  const [loaded, setLoaded] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [mapInstanceKey, setMapInstanceKey] = useState(0)
  const [showingAll, setShowingAll] = useState(false)
  const [pinnedAlbumKey, setPinnedAlbumKey] = useState<string | null>(null)
  const [mobilePreview, setMobilePreview] = useState<MobileMapPreview | null>(
    null,
  )
  const [mobilePreviewCenter, setMobilePreviewCenter] = useState<
    [longitude: number, latitude: number] | null
  >(null)
  const [mobilePreviewHeight, setMobilePreviewHeight] = useState(0)
  const initialFocusItems = useMemo(() => getInitialFocusItems(items), [items])
  const clusterIndex = useMemo(() => makeClusterIndex(items), [items])
  const clusters = useMemo(
    () => clusterIndex.getClusters(viewport.clusterBounds, viewport.zoom),
    [clusterIndex, viewport.clusterBounds, viewport.zoom],
  )

  useEffect(() => {
    if (loaded || loadFailed || items.length === 0) return

    const timeoutId = window.setTimeout(() => {
      setLoadFailed(true)
    }, MAP_LOAD_TIMEOUT_MS)

    return () => window.clearTimeout(timeoutId)
  }, [items.length, loadFailed, loaded, mapInstanceKey])

  const syncMapState = useCallback(() => {
    const map = mapRef.current
    if (!map) return

    const bounds = getMapBounds(map)
    setViewport({
      bounds,
      clusterBounds: expandMapBounds(bounds),
      zoom: Math.floor(map.getZoom()),
    })
  }, [])

  const handleLoad = useCallback(() => {
    const map = mapRef.current
    if (!map) return

    fitMapToItems(map, initialFocusItems, false)
    requestAnimationFrame(() => {
      syncMapState()
      setLoaded(true)
      setLoadFailed(false)
      setShowingAll(false)
    })
  }, [initialFocusItems, syncMapState])

  const retryMap = useCallback(() => {
    setLoaded(false)
    setLoadFailed(false)
    setMapInstanceKey((currentKey) => currentKey + 1)
  }, [])

  const closeMobilePreview = useCallback(() => {
    setMobilePreview(null)
    setMobilePreviewCenter(null)
    setMobilePreviewHeight(0)
    mapRef.current?.easeTo({
      padding: EMPTY_PADDING,
      duration: 220,
    })
  }, [])

  useEffect(() => {
    if (!mobilePreview || !mobilePreviewCenter || mobilePreviewHeight <= 0) {
      return
    }

    mapRef.current?.easeTo({
      center: mobilePreviewCenter,
      padding: {
        ...EMPTY_PADDING,
        bottom: mobilePreviewHeight + MOBILE_PREVIEW_MAP_GAP,
      },
      duration: 320,
    })
  }, [mobilePreview, mobilePreviewCenter, mobilePreviewHeight])

  const openMobilePreview = useCallback(
    (
      preview: MobileMapPreview,
      center: [longitude: number, latitude: number],
    ) => {
      setMobilePreviewHeight(0)
      setMobilePreviewCenter(center)
      setMobilePreview(preview)
    },
    [],
  )

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
        onClick={() => {
          setPinnedAlbumKey(null)
          if (mobilePreview) closeMobilePreview()
        }}
        onLoad={handleLoad}
        onError={() => {
          if (!loaded) setLoadFailed(true)
        }}
        onMoveEnd={syncMapState}
      >
        {clusters.map((feature) => {
          const [longitude, latitude] = feature.geometry.coordinates
          if (
            'cluster' in feature.properties &&
            feature.properties.cluster === true
          ) {
            const { cluster_id: clusterId, point_count: pointCount } =
              feature.properties
            const clusterItems = clusterIndex
              .getLeaves(clusterId, 6)
              .map((leaf) => leaf.properties.item)

            return (
              <ClusterMarker
                key={`cluster-${clusterId}`}
                longitude={longitude}
                latitude={latitude}
                count={pointCount}
                items={clusterItems}
                canHover={canHover}
                imageLoading={getMapMarkerImageLoading(
                  longitude,
                  latitude,
                  viewport.bounds,
                )}
                onExpand={() => {
                  setPinnedAlbumKey(null)
                  const map = mapRef.current
                  if (!map) return

                  const expansionZoom =
                    clusterIndex.getClusterExpansionZoom(clusterId)
                  if (
                    shouldPreviewClusterOnTouch({
                      canHover,
                      expansionZoom,
                      maxClusterZoom: MAX_CLUSTER_ZOOM,
                    })
                  ) {
                    openMobilePreview(
                      {
                        type: 'cluster',
                        count: pointCount,
                        items: clusterItems,
                      },
                      [longitude, latitude],
                    )
                    return
                  }

                  setMobilePreview(null)
                  setMobilePreviewCenter(null)
                  setMobilePreviewHeight(0)
                  map.easeTo({
                    center: [longitude, latitude],
                    zoom: Math.min(expansionZoom, 16),
                    padding: EMPTY_PADDING,
                    duration: 700,
                  })
                }}
              />
            )
          }

          const item = feature.properties.item

          return (
            <AlbumMarker
              key={item.key}
              item={item}
              canHover={canHover}
              imageLoading={getMapMarkerImageLoading(
                longitude,
                latitude,
                viewport.bounds,
              )}
              pinned={pinnedAlbumKey === item.key}
              onPinnedChange={(pinned) => {
                setPinnedAlbumKey(pinned ? item.key : null)
              }}
              onPreview={() =>
                openMobilePreview({ type: 'album', item }, [
                  item.location.lng,
                  item.location.lat,
                ])
              }
            />
          )
        })}
      </Map>

      <MapControls
        hidden={mobilePreview !== null || items.length === 0}
        showingAll={showingAll}
        onZoomIn={() => mapRef.current?.zoomIn({ duration: 250 })}
        onZoomOut={() => mapRef.current?.zoomOut({ duration: 250 })}
        onToggleExtent={() => {
          const map = mapRef.current
          if (map) {
            setPinnedAlbumKey(null)
            setMobilePreview(null)
            setMobilePreviewCenter(null)
            setMobilePreviewHeight(0)
            map.setPadding(EMPTY_PADDING)
            if (showingAll) {
              fitMapToItems(map, initialFocusItems, true)
              setShowingAll(false)
              return
            }

            fitMapToItems(map, items, true)
            setShowingAll(initialFocusItems.length < items.length)
          }
        }}
      />

      {mobilePreview && (
        <MobileMapPreviewSheet
          preview={mobilePreview}
          onDismiss={closeMobilePreview}
          onHeightChange={setMobilePreviewHeight}
        />
      )}

      {!loaded && !loadFailed && (
        <MapLoadingState className="absolute inset-0 z-30" />
      )}

      {!loaded && loadFailed && (
        <MapErrorState className="absolute inset-0 z-30" onRetry={retryMap} />
      )}

      {loaded && items.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
          <p className="border-overlay bg-surface/95 text-subtle rounded-full border px-4 py-2 text-sm shadow-xl">
            No mapped albums yet
          </p>
        </div>
      )}
    </main>
  )
}
