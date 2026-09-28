import type { Metadata } from 'next'
import { AlbumMapLoader } from '@/components/map'
import { getAlbumMapItems, getPhotoMapItems } from '@/lib/album/map'

export const metadata: Metadata = {
  title: 'Map',
}

export default async function MapPage() {
  const [items, photos] = await Promise.all([
    getAlbumMapItems(),
    getPhotoMapItems(),
  ])

  return <AlbumMapLoader items={items} photos={photos} />
}
