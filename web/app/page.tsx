import { PhotoGallery, PRIORITY_PHOTO_COUNT } from '@/components/gallery'
import { ImagePreloads } from '@/components/image'
import { getPhotoCollection } from '@/lib/photo/collection'

export default async function Page() {
  const photoCollection = await getPhotoCollection()

  const preloadUrls = photoCollection.photos
    .slice(0, PRIORITY_PHOTO_COUNT)
    .map((photo) => photo.thumbnail.url)

  return (
    <>
      <ImagePreloads urls={preloadUrls} />
      <PhotoGallery photos={photoCollection.photos} />
    </>
  )
}
