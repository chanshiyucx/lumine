import { useMemo } from 'react'
import { ALBUM_CLUSTER_MAX_ZOOM, MAP_MAX_ZOOM } from '@/lib/map-config'
import type { AlbumMapItem, PhotoMapItem } from '@/lib/map-types'
import {
  createItemMarkerData,
  createMapClusterLayer,
  getMapLayerMarkers,
  type MapMarkerData,
  type PinnedSelection,
} from '../lib/map-clustering'
import {
  getMapMarkerImageLoading,
  type MapViewportState,
} from '../lib/map-viewport'

interface UseMapClustersOptions {
  albumItems: readonly AlbumMapItem[]
  photos: readonly PhotoMapItem[]
  viewport: MapViewportState
  pinnedSelection: PinnedSelection | null
}

export function useMapClusters({
  albumItems,
  photos,
  viewport,
  pinnedSelection,
}: UseMapClustersOptions): readonly MapMarkerData[] {
  const pinnedAlbumKey =
    pinnedSelection?.kind === 'album' ? pinnedSelection.key : null
  const pinnedPhotoKey =
    pinnedSelection?.kind === 'photo' ? pinnedSelection.key : null
  const pinnedPhotoCluster =
    pinnedSelection?.kind === 'photo-cluster' ? pinnedSelection : null

  const albumLayer = useMemo(
    () =>
      createMapClusterLayer(albumItems, pinnedAlbumKey, ALBUM_CLUSTER_MAX_ZOOM),
    [albumItems, pinnedAlbumKey],
  )
  const availablePhotos = useMemo(() => {
    if (!pinnedPhotoCluster) return photos

    const pinnedKeys = new Set(pinnedPhotoCluster.items.map((item) => item.key))
    return photos.filter((photo) => !pinnedKeys.has(photo.key))
  }, [photos, pinnedPhotoCluster])
  const photoLayer = useMemo(
    () => createMapClusterLayer(availablePhotos, pinnedPhotoKey, MAP_MAX_ZOOM),
    [availablePhotos, pinnedPhotoKey],
  )
  const albumMarkers = useMemo(
    () => getMapLayerMarkers({ kind: 'album', ...albumLayer }, viewport),
    [albumLayer, viewport],
  )
  const photoMarkers = useMemo(
    () => getMapLayerMarkers({ kind: 'photo', ...photoLayer }, viewport),
    [photoLayer, viewport],
  )

  return useMemo(() => {
    const markers: MapMarkerData[] = [...albumMarkers, ...photoMarkers]
    for (const item of [albumLayer.selectedItem, photoLayer.selectedItem]) {
      if (item) markers.push(createItemMarkerData(item, true, viewport.bounds))
    }
    if (pinnedPhotoCluster) {
      const { key, items, location } = pinnedPhotoCluster
      markers.push({
        type: 'cluster',
        key,
        kind: 'photo',
        items,
        location,
        count: items.length,
        canExpand: false,
        pinned: true,
        imageLoading: getMapMarkerImageLoading(
          location.lng,
          location.lat,
          viewport.bounds,
        ),
      })
    }
    return markers
  }, [
    albumMarkers,
    photoMarkers,
    albumLayer.selectedItem,
    photoLayer.selectedItem,
    pinnedPhotoCluster,
    viewport.bounds,
  ])
}
