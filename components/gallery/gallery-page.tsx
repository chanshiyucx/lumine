import { notFound } from 'next/navigation'
import { photoCollection, type GalleryPhoto } from '@/lib/photos'
import { Masonry } from './masonry'

interface GalleryPageProps {
  initialPhotoSlug?: string
}

export function GalleryPage({ initialPhotoSlug }: GalleryPageProps) {
  const photos: GalleryPhoto[] = photoCollection.photos
  const hasInitialPhoto =
    !initialPhotoSlug || photos.some((photo) => photo.slug === initialPhotoSlug)

  if (!hasInitialPhoto) {
    notFound()
  }

  return <Masonry photos={photos} initialPhotoSlug={initialPhotoSlug} />
}
