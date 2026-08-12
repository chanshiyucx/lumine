export type MapBounds = [
  west: number,
  south: number,
  east: number,
  north: number,
]

export const WORLD_BOUNDS: MapBounds = [-180, -85, 180, 85]
export const CLUSTER_RADIUS = 72
export const MAX_CLUSTER_ZOOM = 15
export const CLUSTER_PREVIEW_CAPACITY = 6
