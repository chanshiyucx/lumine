import { decodeEncodedPathSegment, encodePathSegment } from './url-segments'

const ALBUM_PATH_PREFIX = '/albums/'
const PHOTO_PATH_PREFIX = '/photos/'

export function getAlbumPath(albumId: string) {
  return `${ALBUM_PATH_PREFIX}${encodePathSegment(albumId)}`
}

export function getPhotoPath(photoId: string) {
  return `${PHOTO_PATH_PREFIX}${encodePathSegment(photoId)}`
}

export function getPhotoOgPath(photoId: string) {
  return `${getPhotoPath(photoId)}/opengraph-image`
}

export function getPhotoSlugFromPathname(pathname: string) {
  if (!isPhotoPathname(pathname)) {
    return null
  }

  const rawSlug = pathname.slice(PHOTO_PATH_PREFIX.length)

  if (!rawSlug || rawSlug.includes('/')) {
    return null
  }

  return decodeEncodedPathSegment(rawSlug)
}

export function isPhotoPathname(pathname: string) {
  return pathname.startsWith(PHOTO_PATH_PREFIX)
}
