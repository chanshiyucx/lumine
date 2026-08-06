import Supercluster from 'supercluster'

const WORLD_BOUNDS: [number, number, number, number] = [-180, -85, 180, 85]
const ANALYSIS_ZOOM = 1
const CLUSTER_RADIUS = 72
const MIN_DOMINANT_ALBUMS = 3
const MIN_DOMINANT_SHARE = 0.6

interface LocatedItem {
  location: {
    lat: number
    lng: number
  }
}

interface ItemPointProperties<T extends LocatedItem> {
  item: T
}

function getCandidateCount<T extends LocatedItem>(
  candidate:
    | Supercluster.ClusterFeature<Supercluster.AnyProps>
    | Supercluster.PointFeature<ItemPointProperties<T>>,
) {
  return 'cluster' in candidate.properties
    ? candidate.properties.point_count
    : 1
}

/**
 * Selects a clearly dominant geographic group for the initial viewport.
 * Falls back to every item when the map has no single dominant region.
 */
export function getInitialFocusItems<T extends LocatedItem>(
  items: readonly T[],
): T[] {
  if (items.length < MIN_DOMINANT_ALBUMS) return [...items]

  const points: Supercluster.PointFeature<ItemPointProperties<T>>[] = items.map(
    (item) => ({
      type: 'Feature',
      properties: { item },
      geometry: {
        type: 'Point',
        coordinates: [item.location.lng, item.location.lat],
      },
    }),
  )
  const clusterIndex = new Supercluster<ItemPointProperties<T>>({
    radius: CLUSTER_RADIUS,
  }).load(points)
  const candidates = clusterIndex.getClusters(WORLD_BOUNDS, ANALYSIS_ZOOM)
  const dominantCandidate = candidates.reduce((dominant, candidate) =>
    getCandidateCount(candidate) > getCandidateCount(dominant)
      ? candidate
      : dominant,
  )

  if (!('cluster' in dominantCandidate.properties)) return [...items]

  const dominantCount = dominantCandidate.properties.point_count
  if (
    dominantCount < MIN_DOMINANT_ALBUMS ||
    dominantCount / items.length < MIN_DOMINANT_SHARE
  ) {
    return [...items]
  }

  return clusterIndex
    .getLeaves(dominantCandidate.properties.cluster_id, Infinity)
    .map((leaf) => leaf.properties.item)
}
