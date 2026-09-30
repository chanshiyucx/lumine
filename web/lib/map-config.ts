export const MAP_MAX_ZOOM = 17
export const MAP_PREVIEW_CAPACITY = 6
export const MAP_MAX_LATITUDE = 85.0511287798066

export type MapBounds = [
  west: number,
  south: number,
  east: number,
  north: number,
]

export const WORLD_BOUNDS: MapBounds = [-180, -90, 180, 90]
export const MAP_STYLE_URL =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
export const CLUSTER_RADIUS = 72
export const ALBUM_CLUSTER_MAX_ZOOM = 15
