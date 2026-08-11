import type { Metadata } from 'next'
import { AlbumMapLoader } from '@/components/map'
import { getAlbumMapItems } from '@/components/map/lib/album-map-data'

export const metadata: Metadata = {
  title: 'Map',
}

export default async function MapPage() {
  const items = await getAlbumMapItems()

  return <AlbumMapLoader items={items} />
}
