import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { AlbumMapItem } from '@/lib/album/map'
import { prepareAlbumMapSelection } from './album-map-selection'
import { WORLD_BOUNDS } from './map-config'

function makeItem(key: string, latitude: number): AlbumMapItem {
  return {
    key,
    href: `/albums/${key}`,
    label: key,
    dateLabel: '2026',
    photoCount: 1,
    location: { lat: latitude, lng: 13.4 },
    covers: [
      {
        href: `/photos/${key}`,
        thumbHash: 'test',
        thumbnail: { url: `/thumbnails/${key}.webp`, width: 100, height: 100 },
      },
    ],
  }
}

test('the pinned album remains separate while nearby albums cluster', () => {
  const items = [
    makeItem('first', 52.5),
    makeItem('pinned', 52.5001),
    makeItem('third', 52.5002),
  ]
  const { selectedItem, clusterIndex } = prepareAlbumMapSelection(
    items,
    'pinned',
  )
  const clusters = clusterIndex.getClusters(WORLD_BOUNDS, 1)

  assert.equal(selectedItem?.key, 'pinned')
  assert.equal(clusters.length, 1)
  const cluster = clusters[0]
  assert.ok('cluster' in cluster.properties)
  assert.equal(cluster.properties.point_count, 2)
  assert.deepEqual(
    clusterIndex
      .getLeaves(cluster.properties.cluster_id, Infinity)
      .map((leaf) => leaf.properties.item.key),
    ['first', 'third'],
  )

  const zoomedInItems = clusterIndex
    .getClusters(WORLD_BOUNDS, 17)
    .map((point) => {
      assert.ok(!('cluster' in point.properties))
      return point.properties.item.key
    })
  assert.deepEqual(zoomedInItems, ['first', 'third'])
})

test('a missing pinned album keeps every item in the cluster index', () => {
  const items = [makeItem('first', 52.5), makeItem('second', 52.5001)]
  const { selectedItem, clusterIndex } = prepareAlbumMapSelection(
    items,
    'removed',
  )
  const clusters = clusterIndex.getClusters(WORLD_BOUNDS, 1)

  assert.equal(selectedItem, null)
  assert.equal(clusters.length, 1)
  assert.ok('cluster' in clusters[0].properties)
  assert.equal(clusters[0].properties.point_count, items.length)
})
