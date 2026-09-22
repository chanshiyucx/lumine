import 'server-only'
import { notFound } from 'next/navigation'
import { getPhotoCollection } from '@/lib/photo/collection'
import { normalizePathSegment } from '@/lib/url-segments'

export async function loadPhotoRouteData(
  params: PageProps<'/photos/[photoId]'>['params'],
) {
  const [{ photoId }, photoCollection] = await Promise.all([
    params,
    getPhotoCollection(),
  ])
  const normalizedPhotoId = normalizePathSegment(photoId)
  const photo = photoCollection.photos.find(
    ({ slug }) => slug === normalizedPhotoId,
  )

  if (!photo) {
    notFound()
  }

  return { photo, photos: photoCollection.photos }
}
