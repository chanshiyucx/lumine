import { GalleryPage } from '@/components/gallery/gallery-page'
import { getPhotoCollection } from '@/lib/photo-collection'

export async function generateStaticParams() {
  const photoCollection = await getPhotoCollection()

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

  return <GalleryPage initialPhotoSlug={photoId} />
}
