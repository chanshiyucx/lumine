import { notFound } from 'next/navigation'
import { photoCollection, type GalleryPhoto } from '@/lib/photos'
import { PhotoMasonry } from './photo-masonry'

interface PhotoGalleryPageProps {
  initialPhotoSlug?: string
}

export function PhotoGalleryPage({ initialPhotoSlug }: PhotoGalleryPageProps) {
  const photos: GalleryPhoto[] = photoCollection.photos
  const hasInitialPhoto =
    !initialPhotoSlug || photos.some((photo) => photo.slug === initialPhotoSlug)

  if (!hasInitialPhoto) {
    notFound()
  }

  return <PhotoMasonry photos={photos} initialPhotoSlug={initialPhotoSlug} />
}
