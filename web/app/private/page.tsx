import { PhotoGallery } from '@/components/gallery'
import { PrivateUnlock } from '@/components/private'
import { loadPrivatePhotos } from './_data'
import { unlockPrivateMode } from './actions'

// The response depends on the session cookie, so it is rendered per request and never cached.
export const dynamic = 'force-dynamic'

export default async function PrivatePage() {
  const photos = await loadPrivatePhotos()

  if (!photos) {
    return <PrivateUnlock action={unlockPrivateMode} />
  }

  return <PhotoGallery photos={photos} scope="private" />
}
