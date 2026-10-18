import { useEffect, useMemo, useRef, useState } from 'react'
import Map, {
  type LngLatBoundsLike,
  type MapProps,
  type MapRef,
  type PaddingOptions,
} from 'react-map-gl/maplibre'
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
const FOCUSED_PHOTO_ZOOM = 15
const FIT_MAX_ZOOM = 10

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

function getItemsBounds(items: readonly MapItem[]): LngLatBoundsLike {
  const longitudes = items.map((item) => item.location.lng)
  const latitudes = items.map((item) => clampMapLatitude(item.location.lat))

  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ]
}

function getFitPadding(width: number, height: number): PaddingOptions {
  const horizontalPadding = Math.max(width * 0.06, 40)
  const verticalPadding = Math.max(height * 0.1, 64)

  return {
    top: Math.max(verticalPadding, 88),
    right: horizontalPadding,
    bottom: verticalPadding,
    left: horizontalPadding,
  }
}

function fitMapToItems(map: MapRef, items: readonly MapItem[]) {
  if (items.length === 0) return

  const container = map.getContainer()
  map.fitBounds(getItemsBounds(items), {
    padding: getFitPadding(container.offsetWidth, container.offsetHeight),
    duration: 900,
    maxZoom: FIT_MAX_ZOOM,
  })
}

function getInitialViewState(
  focusedPhoto: PhotoMapItem | undefined,
  initialFocusItems: readonly MapItem[],
): MapProps['initialViewState'] {
  if (focusedPhoto) {
    return {
      longitude: focusedPhoto.location.lng,
      latitude: clampMapLatitude(focusedPhoto.location.lat),
      zoom: FOCUSED_PHOTO_ZOOM,
    }
  }

  if (initialFocusItems.length === 0) {
    return { longitude: 20, latitude: 42, zoom: 1 }
  }

  // Fitting before the first render lets `load` wait for the target tiles.
  // The map fills the viewport, so the window size matches its container.
  return {
    bounds: getItemsBounds(initialFocusItems),
    fitBoundsOptions: {
      padding: getFitPadding(window.innerWidth, window.innerHeight),
      maxZoom: FIT_MAX_ZOOM,
    },
  }
}

export function PhotoMap({ albumItems, photos, photoId }: PhotoMapProps) {
  const mapRef = useRef<MapRef>(null)
  const styleLoadedRef = useRef(false)
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
    // The initial camera is applied while the map is created, before move
    // events are bound, so read the viewport once here.
    syncMapState()
    setLoadStatus('loaded')
    setShowingAll(false)
  }

  const handleError = () => {
    // Only a style that never loads is fatal. Tile, sprite and glyph failures
    // still let the map load, and the timeout covers loads that stall.
    if (loadStatus === 'loading' && !styleLoadedRef.current) {
      setLoadStatus('failed')
    }
  }

  const retryMap = () => {
    styleLoadedRef.current = false
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
      fitMapToItems(map, initialFocusItems)
      setShowingAll(false)
      return
    }

    fitMapToItems(map, allItems)
    setShowingAll(initialFocusItems.length < allItems.length)
  }

  return (
    <main className="photo-map relative h-svh overflow-hidden">
      <Map
        key={mapInstanceKey}
        ref={mapRef}
        initialViewState={getInitialViewState(focusedPhoto, initialFocusItems)}
        minZoom={1}
        maxZoom={MAP_MAX_ZOOM}
        mapStyle={MAP_STYLE_URL}
        projection={{ type: 'mercator' }}
        attributionControl={false}
        onClick={() => setPinnedSelection(null)}
        onLoad={handleLoad}
        onStyleData={() => {
          styleLoadedRef.current = true
        }}
        onError={handleError}
        onMoveEnd={syncMapState}
      >
        {/* The viewport is unknown until load, so skip marker work before it. */}
        {loadStatus === 'loaded' && (
          <MapMarkers
            markers={markers}
            onPinnedChange={setPinnedSelection}
            onClusterExpand={handleClusterExpand}
          />
        )}
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
