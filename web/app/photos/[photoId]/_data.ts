import 'server-only'
import { notFound } from 'next/navigation'
import { getPhotoCollection } from '@/lib/photo/collection'
import { normalizePathSegment } from '@/lib/url-segments'

export async function loadPhotoRouteData(photoId: string) {
  const photoCollection = await getPhotoCollection()
  const normalizedPhotoId = normalizePathSegment(photoId)
  const photo = photoCollection.photos.find(
    (photo) => photo.slug === normalizedPhotoId,
  )

  if (!photo) {
    notFound()
  }

  return { photo, photos: photoCollection.photos }
}
