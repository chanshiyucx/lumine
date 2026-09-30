import Supercluster from 'supercluster'
import {
  CLUSTER_RADIUS,
  MAP_MAX_ZOOM,
  MAP_PREVIEW_CAPACITY,
  type MapBounds,
} from '@/lib/map-config'
import type {
  AlbumMapItem,
  MapItem,
  MapLocation,
  PhotoMapItem,
} from '@/lib/map-types'
import {
  clampMapLatitude,
  getMapMarkerImageLoading,
  type MapViewportState,
} from './map-viewport'

type ClusterItems<T extends MapItem> = readonly [T, ...T[]]

export type PinnedSelection =
  | { kind: 'album' | 'photo'; key: string }
  | {
      kind: 'photo-cluster'
      key: string
      items: ClusterItems<PhotoMapItem>
      location: MapLocation
    }

interface MapPointProperties<T extends MapItem> {
  item: T
}

interface MapClusterProperties {
  minItemKey: string
}

interface MapClusterLayer<T extends MapItem> {
  selectedItem: T | null
  clusterIndex: Supercluster<MapPointProperties<T>, MapClusterProperties>
}

type MapLayer =
  | ({ kind: 'album' } & MapClusterLayer<AlbumMapItem>)
  | ({ kind: 'photo' } & MapClusterLayer<PhotoMapItem>)

interface MarkerDataBase {
  key: string
  imageLoading: 'eager' | 'lazy'
}

export interface MapItemMarkerData extends MarkerDataBase {
  type: 'item'
  item: MapItem
  pinned: boolean
}

interface ClusterMarkerDataBase extends MarkerDataBase {
  type: 'cluster'
  location: MapLocation
  count: number
}

export interface ExpandableClusterMarkerData<
  T extends MapItem,
> extends ClusterMarkerDataBase {
  kind: T['kind']
  items: ClusterItems<T>
  canExpand: true
  expansionZoom: number
  pinned: false
}

export interface TerminalPhotoClusterMarkerData extends ClusterMarkerDataBase {
  kind: 'photo'
  items: ClusterItems<PhotoMapItem>
  canExpand: false
  pinned: boolean
}

export type MapClusterMarkerData =
  | ExpandableClusterMarkerData<AlbumMapItem>
  | ExpandableClusterMarkerData<PhotoMapItem>
  | TerminalPhotoClusterMarkerData

export type MapMarkerData = MapItemMarkerData | MapClusterMarkerData

export function createMapClusterLayer<T extends MapItem>(
  items: readonly T[],
  pinnedItemKey: string | null,
  maxZoom: number,
): MapClusterLayer<T> {
  const selectedItem = pinnedItemKey
    ? (items.find((item) => item.key === pinnedItemKey) ?? null)
    : null
  const points: Supercluster.PointFeature<MapPointProperties<T>>[] = items
    .filter((item) => item.key !== selectedItem?.key)
    .map((item) => ({
      type: 'Feature',
      properties: { item },
      geometry: {
        type: 'Point',
        coordinates: [item.location.lng, clampMapLatitude(item.location.lat)],
      },
    }))

  return {
    selectedItem,
    clusterIndex: new Supercluster<MapPointProperties<T>, MapClusterProperties>(
      {
        radius: CLUSTER_RADIUS,
        maxZoom,
        map: ({ item }) => ({ minItemKey: item.key }),
        reduce: (accumulated, next) => {
          if (next.minItemKey < accumulated.minItemKey) {
            accumulated.minItemKey = next.minItemKey
          }
        },
      },
    ).load(points),
  }
}

function getClusterItems<T extends MapItem>(
  index: MapClusterLayer<T>['clusterIndex'],
  clusterId: number,
  limit: number,
): ClusterItems<T> {
  // Valid Supercluster clusters contain at least two points; limits here are positive.
  return index
    .getLeaves(clusterId, limit)
    .map((leaf) => leaf.properties.item) as [T, ...T[]]
}

export function createItemMarkerData(
  item: MapItem,
  pinned: boolean,
  viewportBounds: MapBounds,
): MapItemMarkerData {
  return {
    type: 'item',
    key: item.key,
    item,
    pinned,
    imageLoading: getMapMarkerImageLoading(
      item.location.lng,
      item.location.lat,
      viewportBounds,
    ),
  }
}

export function getMapLayerMarkers(
  layer: MapLayer,
  viewport: MapViewportState,
): MapMarkerData[] {
  return layer.clusterIndex
    .getClusters(viewport.clusterBounds, viewport.zoom)
    .map((feature): MapMarkerData => {
      if ('item' in feature.properties) {
        return createItemMarkerData(
          feature.properties.item,
          false,
          viewport.bounds,
        )
      }

      const [lng, lat] = feature.geometry.coordinates
      const {
        cluster_id: clusterId,
        point_count: count,
        minItemKey,
      } = feature.properties
      const expansionZoom = Math.min(
        MAP_MAX_ZOOM,
        layer.clusterIndex.getClusterExpansionZoom(clusterId),
      )
      const marker: ClusterMarkerDataBase = {
        type: 'cluster',
        key: `${layer.kind}-cluster-${viewport.zoom}-${minItemKey}`,
        location: { lng, lat },
        count,
        imageLoading: getMapMarkerImageLoading(lng, lat, viewport.bounds),
      }

      if (layer.kind === 'album') {
        // Album clusters split above zoom 15, before the map reaches its maximum.
        return {
          ...marker,
          kind: 'album',
          items: getClusterItems(
            layer.clusterIndex,
            clusterId,
            MAP_PREVIEW_CAPACITY,
          ),
          canExpand: true,
          expansionZoom,
          pinned: false,
        }
      }

      const items = getClusterItems(layer.clusterIndex, clusterId, count)
      return expansionZoom > viewport.zoom
        ? {
            ...marker,
            kind: 'photo',
            items,
            canExpand: true,
            expansionZoom,
            pinned: false,
          }
        : { ...marker, kind: 'photo', items, canExpand: false, pinned: false }
    })
}
