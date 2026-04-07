import { notFound } from 'next/navigation'
import { getPhotoCollection } from '@/lib/photo-collection'
import type { Photo } from '@/lib/photos'
import { Masonry } from './masonry'

interface GalleryPageProps {
  initialPhotoSlug?: string
}

export async function GalleryPage({ initialPhotoSlug }: GalleryPageProps = {}) {
  const photoCollection = await getPhotoCollection()
  const photos: Photo[] = photoCollection.photos
  const hasInitialPhoto =
    !initialPhotoSlug || photos.some((photo) => photo.slug === initialPhotoSlug)

  if (!hasInitialPhoto) {
    notFound()
  }

  return <Masonry photos={photos} initialPhotoSlug={initialPhotoSlug} />
}
