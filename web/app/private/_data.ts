import 'server-only'
import { notFound } from 'next/navigation'
import { getPrivatePhotoCollection } from '@/lib/private/collection'
import { getPrivateConfig } from '@/lib/private/config'
import { getPrivateSession } from '@/lib/private/session'

/** The private photos, or null when this visitor has not unlocked them. */
export async function loadPrivatePhotos() {
  const config = getPrivateConfig()

  if (!config) {
    notFound()
  }

  const session = await getPrivateSession(config)

  if (!session) {
    return null
  }

  const { photos } = await getPrivatePhotoCollection(config, session)

  return photos
}
