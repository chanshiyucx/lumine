import { MEDIA_ORIGIN_ENV } from './env'

let cachedMediaOrigin: URL | undefined

const ALBUM_MAP_PATH = 'map.json'
const PHOTO_MANIFEST_PATH = 'manifest.json'

function getMediaOrigin() {
  if (cachedMediaOrigin) {
    return cachedMediaOrigin
  }

  const mediaOrigin = process.env[MEDIA_ORIGIN_ENV]

  if (!mediaOrigin) {
    throw new Error(
      `Missing ${MEDIA_ORIGIN_ENV}. Set it to the media host origin, for example https://cloud.example.com.`,
    )
  }

  cachedMediaOrigin = new URL('/', mediaOrigin)
  return cachedMediaOrigin
}

function resolveMediaUrl(pathname: string) {
  return new URL(pathname.replace(/^\/+/, ''), getMediaOrigin()).toString()
}

export function getPhotoAssetUrl(pathname: string) {
  return resolveMediaUrl(pathname)
}

export function getPhotoManifestUrl() {
  return resolveMediaUrl(PHOTO_MANIFEST_PATH)
}

export function getAlbumMapUrl() {
  return resolveMediaUrl(ALBUM_MAP_PATH)
}
