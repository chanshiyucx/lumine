import type { MapBounds } from './map-config'

export const MAP_BOUNDS_OVERSCAN = 0.25

function normalizeLongitude(longitude: number) {
  return ((((longitude + 180) % 360) + 360) % 360) - 180
}

export function expandMapBounds(
  bounds: MapBounds,
  ratio = MAP_BOUNDS_OVERSCAN,
): MapBounds {
  const [west, south, east, north] = bounds
  const longitudePadding = (east - west) * ratio
  const latitudePadding = (north - south) * ratio

  return [
    west - longitudePadding,
    Math.max(-90, south - latitudePadding),
    east + longitudePadding,
    Math.min(90, north + latitudePadding),
  ]
}

export function isPointWithinMapBounds(
  longitude: number,
  latitude: number,
  bounds: MapBounds,
) {
  const [west, south, east, north] = bounds
  if (latitude < south || latitude > north) return false
  if (east - west >= 360) return true

  const normalizedLongitude = normalizeLongitude(longitude)
  const normalizedWest = normalizeLongitude(west)
  const normalizedEast = normalizeLongitude(east)

  return normalizedWest <= normalizedEast
    ? normalizedLongitude >= normalizedWest &&
        normalizedLongitude <= normalizedEast
    : normalizedLongitude >= normalizedWest ||
        normalizedLongitude <= normalizedEast
}

export function getMapMarkerImageLoading(
  longitude: number,
  latitude: number,
  viewportBounds: MapBounds,
): 'eager' | 'lazy' {
  return isPointWithinMapBounds(longitude, latitude, viewportBounds)
    ? 'eager'
    : 'lazy'
}
