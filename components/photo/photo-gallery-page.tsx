import { notFound } from 'next/navigation'
import { photoCollection, type GalleryPhoto } from '@/lib/photos'
import { PhotoMasonry } from './photo-masonry'

interface PhotoGalleryPageProps {
  initialPhotoSlug?: string
  photos?: GalleryPhoto[]
}

export function PhotoGalleryPage({
  initialPhotoSlug,
  photos = photoCollection.photos,
}: PhotoGalleryPageProps) {
  const hasInitialPhoto =
    !initialPhotoSlug || photos.some((photo) => photo.slug === initialPhotoSlug)

  if (!hasInitialPhoto) {
    notFound()
  }

  return <PhotoMasonry photos={photos} initialPhotoSlug={initialPhotoSlug} />
}
