import Supercluster from 'supercluster'
import type { MapItem } from '@/lib/album/map'
import { CLUSTER_RADIUS, MAX_CLUSTER_ZOOM } from '@/lib/map-config'
import { clampMapLatitude } from './map-viewport'

interface MapPointProperties<T extends MapItem> {
  item: T
}

interface MapClusterProperties {
  minItemKey: string
}

export function prepareMapSelection<T extends MapItem>(
  items: T[],
  pinnedItemKey: string | null,
  maxZoom = MAX_CLUSTER_ZOOM,
) {
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
