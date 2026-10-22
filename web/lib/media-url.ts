import { MEDIA_BASE_URL_ENV } from './env'

let cachedMediaBaseUrl: URL | undefined

const ALBUM_MAP_PATH = 'map.json'
const PHOTO_MANIFEST_PATH = 'manifest.json'

function getMediaBaseUrl() {
  if (cachedMediaBaseUrl) {
    return cachedMediaBaseUrl
  }

  const mediaBaseUrl = process.env[MEDIA_BASE_URL_ENV]

  if (!mediaBaseUrl) {
    throw new Error(
      `Missing ${MEDIA_BASE_URL_ENV}. Set it to the public media directory, for example https://cloud.example.com/public/.`,
    )
  }

  // Keep the directory path and end it with a slash so relative asset paths resolve inside it.
  const baseUrl = new URL(mediaBaseUrl)
  baseUrl.pathname = baseUrl.pathname.replace(/\/*$/, '/')
  baseUrl.search = ''
  baseUrl.hash = ''
  cachedMediaBaseUrl = baseUrl
  return cachedMediaBaseUrl
}

function resolveMediaUrl(pathname: string) {
  return new URL(pathname.replace(/^\/+/, ''), getMediaBaseUrl()).toString()
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
