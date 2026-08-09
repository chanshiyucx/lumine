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
import { MapControls } from './map-controls'
import {
  MobileMapPreviewSheet,
  type MobileMapPreview,
} from './mobile-map-preview-sheet'

const MAP_STYLE_URL =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const CAN_HOVER_QUERY =
  '(min-width: 768px) and (hover: hover) and (pointer: fine)'
const MOBILE_PREVIEW_BOTTOM_PADDING = 260
const MAP_LOAD_TIMEOUT_MS = 15_000
const EMPTY_PADDING = { top: 0, right: 0, bottom: 0, left: 0 }

interface AlbumPointProperties {
  item: AlbumMapItem
}

interface AlbumMapProps {
  items: AlbumMapItem[]
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
  const canHover = useMediaQuery(CAN_HOVER_QUERY)
  const [bounds, setBounds] = useState<MapBounds>(WORLD_BOUNDS)
  const [zoom, setZoom] = useState(1)
  const [loaded, setLoaded] = useState(false)
  const [loadTimedOut, setLoadTimedOut] = useState(false)
  const [pinnedAlbumKey, setPinnedAlbumKey] = useState<string | null>(null)
  const [mobilePreview, setMobilePreview] = useState<MobileMapPreview | null>(
    null,
  )
  const clusterIndex = useMemo(() => makeClusterIndex(items), [items])
  const clusters = useMemo(
    () => clusterIndex.getClusters(bounds, Math.floor(zoom)),
    [bounds, clusterIndex, zoom],
  )

  useEffect(() => {
    if (loaded) return

    const timeoutId = window.setTimeout(() => {
      setLoadTimedOut(true)
    }, MAP_LOAD_TIMEOUT_MS)

    return () => window.clearTimeout(timeoutId)
  }, [loaded])

  const syncMapState = useCallback(() => {
    const map = mapRef.current
    if (!map) return

    setBounds(getMapBounds(map))
    setZoom(map.getZoom())
  }, [])

  const handleLoad = useCallback(() => {
    const map = mapRef.current
    if (!map) return

    fitMapToItems(map, getInitialFocusItems(items), false)
    setLoaded(true)
    setLoadTimedOut(false)
    requestAnimationFrame(syncMapState)
  }, [items, syncMapState])

  const closeMobilePreview = useCallback(() => {
    setMobilePreview(null)
    mapRef.current?.easeTo({
      padding: EMPTY_PADDING,
      duration: 220,
    })
  }, [])

  const openMobilePreview = useCallback(
    (
      preview: MobileMapPreview,
      center: [longitude: number, latitude: number],
    ) => {
      setMobilePreview(preview)
      mapRef.current?.easeTo({
        center,
        padding: {
          ...EMPTY_PADDING,
          bottom: MOBILE_PREVIEW_BOTTOM_PADDING,
        },
        duration: 320,
      })
    },
    [],
  )

  return (
    <main className="album-map bg-base relative h-svh overflow-hidden">
      <Map
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
        onMove={syncMapState}
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
        onZoomIn={() => mapRef.current?.zoomIn({ duration: 250 })}
        onZoomOut={() => mapRef.current?.zoomOut({ duration: 250 })}
        onReset={() => {
          const map = mapRef.current
          if (map) {
            setPinnedAlbumKey(null)
            setMobilePreview(null)
            map.setPadding(EMPTY_PADDING)
            fitMapToItems(map, items, true)
          }
        }}
      />

      {mobilePreview && (
        <MobileMapPreviewSheet
          preview={mobilePreview}
          onDismiss={closeMobilePreview}
        />
      )}

      {!loaded && (
        <div className="bg-base absolute inset-0 z-30 grid place-items-center">
          {loadTimedOut ? (
            <div className="max-w-xs px-6 text-center" role="alert">
              <p className="text-text font-semibold">Map unavailable</p>
              <p className="text-subtle mt-1 text-sm">
                The map is taking longer than expected to load.
              </p>
              <button
                type="button"
                className="border-text/20 bg-overlay hover:bg-text/15 focus-visible:outline-iris mt-4 cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="text-center" role="status">
              <div className="bg-overlay mx-auto mb-4 size-10 animate-pulse rounded-full motion-reduce:animate-none" />
              <p className="text-subtle text-sm">Loading places…</p>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
