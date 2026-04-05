import { PhotoGalleryPage } from '@/components/photo/photo-gallery-page'
import { photoCollection } from '@/lib/photos'

export function generateStaticParams() {
  return photoCollection.photos.map((photo) => ({
    photoId: photo.slug,
  }))
}

export default async function PhotoPage({
  params,
}: {
  params: Promise<{ photoId: string }>
}) {
  const { photoId } = await params

  return <PhotoGalleryPage initialPhotoSlug={photoId} />
}
