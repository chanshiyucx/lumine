import { PhotoGallery } from '@/components/gallery'
import { getPhotoCollection } from '@/lib/photo/collection'

export default async function Page() {
  const photoCollection = await getPhotoCollection()

  return <PhotoGallery photos={photoCollection.photos} />
}
