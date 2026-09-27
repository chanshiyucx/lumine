export type MapBounds = [
  west: number,
  south: number,
  east: number,
  north: number,
]

export const WORLD_BOUNDS: MapBounds = [-180, -85, 180, 85]
export const MAP_STYLE_URL =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
export const CLUSTER_RADIUS = 72
export const MAX_CLUSTER_ZOOM = 15
export const CLUSTER_PREVIEW_CAPACITY = 6
