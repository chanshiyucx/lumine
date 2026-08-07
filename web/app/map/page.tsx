import { AlbumMapLoader } from '@/components/map'
import { getAlbumMapItems } from '@/components/map/lib/album-map-data'
import { getAlbums } from '@/lib/albums'
import { getPhotoCollection } from '@/lib/photo/collection'

export default async function MapPage() {
  const photoCollection = await getPhotoCollection()
  const items = await getAlbumMapItems(getAlbums(photoCollection.photos))

  return <AlbumMapLoader items={items} />
}
