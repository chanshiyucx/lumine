import 'server-only'
import { createHmac } from 'node:crypto'
import { getAlbumMapLocations } from '@/lib/album/locations'
import { fetchPhotoManifest, toPhotoCollection } from '@/lib/photo/collection'
import type { PrivateConfig } from './config'
import type { PrivateSession } from './session'

export async function getPrivatePhotoCollection(
  config: PrivateConfig,
  session: PrivateSession,
) {
  const [manifest, locations] = await Promise.all([
    fetchPhotoManifest(
      new URL('/manifest.json', config.mediaOrigin).toString(),
      {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${config.manifestToken}` },
      },
    ),
    getAlbumMapLocations(),
  ])

  return toPhotoCollection(manifest, locations, (pathname) =>
    signPrivateAssetUrl(config, pathname, session.expiresAt),
  )
}

// Links stay valid, and browser-cacheable, until the session ends.
// The signature format must match worker/src/index.ts.
function signPrivateAssetUrl(
  config: PrivateConfig,
  pathname: string,
  expiresAt: number,
) {
  const assetPath = pathname.replace(/^\/+/, '')
  const url = new URL(`/${assetPath}`, config.mediaOrigin)
  const sig = createHmac('sha256', config.signingSecret)
    .update(`${expiresAt}:${assetPath}`)
    .digest('base64url')

  url.searchParams.set('exp', String(expiresAt))
  url.searchParams.set('sig', sig)

  return url.toString()
}
