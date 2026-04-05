import { notFound } from 'next/navigation'
import {
  getPhotoBySlug,
  photoCollection,
  type GalleryPhoto,
} from '@/lib/photos'
import { PhotoMasonry } from './photo-masonry'

interface PhotoGalleryPageProps {
  initialPhotoSlug?: string
  photos?: GalleryPhoto[]
}

export function PhotoGalleryPage({
  initialPhotoSlug,
  photos = photoCollection.photos,
}: PhotoGalleryPageProps) {
  if (initialPhotoSlug && !getPhotoBySlug(initialPhotoSlug)) {
    notFound()
  }

  return <PhotoMasonry photos={photos} initialPhotoSlug={initialPhotoSlug} />
}
