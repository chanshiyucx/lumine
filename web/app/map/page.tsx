import type { Metadata } from 'next'
import { PhotoMapLoader } from '@/components/map'
import { getAlbumMapItems, getPhotoMapItems } from '@/lib/map-items'

export const metadata: Metadata = {
  title: 'Map',
}

export default async function MapPage() {
  const [albumItems, photos] = await Promise.all([
    getAlbumMapItems(),
    getPhotoMapItems(),
  ])

  return <PhotoMapLoader albumItems={albumItems} photos={photos} />
}
