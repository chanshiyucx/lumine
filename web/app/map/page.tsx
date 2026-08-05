import { AlbumMapLoader } from '@/components/map'
import { getAlbums } from '@/lib/albums'
import { getAlbumMapItems } from '@/lib/map/album-map-data'
import { getPhotoCollection } from '@/lib/photo/collection'

export default async function MapPage() {
  const photoCollection = await getPhotoCollection()
  const items = await getAlbumMapItems(getAlbums(photoCollection.photos))

  return <AlbumMapLoader items={items} />
}
