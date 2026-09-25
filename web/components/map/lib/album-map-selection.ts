import Supercluster from 'supercluster'
import type { AlbumMapItem } from '@/lib/album/map'
import { CLUSTER_RADIUS, MAX_CLUSTER_ZOOM } from './map-config'

export interface AlbumPointProperties {
  item: AlbumMapItem
}

export function prepareAlbumMapSelection(
  items: AlbumMapItem[],
  pinnedAlbumKey: string | null,
) {
  const selectedItem = pinnedAlbumKey
    ? (items.find((item) => item.key === pinnedAlbumKey) ?? null)
    : null
  const points: Supercluster.PointFeature<AlbumPointProperties>[] = items
    .filter((item) => item.key !== selectedItem?.key)
    .map((item) => ({
      type: 'Feature',
      properties: { item },
      geometry: {
        type: 'Point',
        coordinates: [item.location.lng, item.location.lat],
      },
    }))

  return {
    selectedItem,
    clusterIndex: new Supercluster<AlbumPointProperties>({
      radius: CLUSTER_RADIUS,
      maxZoom: MAX_CLUSTER_ZOOM,
    }).load(points),
  }
}
