import { notFound } from 'next/navigation'
import { PhotoGallery } from '@/components/gallery'
import { PrivateUnlock } from '@/components/private'
import { decodeEncodedPathSegment } from '@/lib/url-segments'
import { loadPrivatePhotos } from '../../_data'
import { unlockPrivateMode } from '../../actions'

// The response depends on the session cookie, so it is rendered per request and never cached.
export const dynamic = 'force-dynamic'

export default async function PrivatePhotoPage({
  params,
}: PageProps<'/private/photos/[photoId]'>) {
  const { photoId } = await params
  const photos = await loadPrivatePhotos()

  // Unlocking refreshes this route, so the photo opens right after the password.
  if (!photos) {
    return <PrivateUnlock action={unlockPrivateMode} />
  }

  const slug = decodeEncodedPathSegment(photoId)
  const photo = photos.find((photo) => photo.slug === slug)

  if (!photo) {
    notFound()
  }

  return (
    <PhotoGallery
      photos={photos}
      initialPhotoSlug={photo.slug}
      scope="private"
    />
  )
}
