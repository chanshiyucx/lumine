import {
  decodeRawPathSegment,
  encodePathSegment,
} from './url-segments'

const ALBUM_PATH_PREFIX = '/albums/'
const PHOTO_PATH_PREFIX = '/photos/'

export function getAlbumPath(albumKey: string) {
  return `${ALBUM_PATH_PREFIX}${encodePathSegment(albumKey)}`
}

export function getPhotoPath(slug: string) {
  return `${PHOTO_PATH_PREFIX}${encodePathSegment(slug)}`
}

export function getPhotoOgPath(slug: string) {
  return `${getPhotoPath(slug)}/opengraph-image`
}

export function getPhotoSlugFromPathname(pathname: string) {
  if (!isPhotoPathname(pathname)) {
    return null
  }

  const rawSlug = pathname.slice(PHOTO_PATH_PREFIX.length)

  if (!rawSlug || rawSlug.includes('/')) {
    return null
  }

  return decodeRawPathSegment(rawSlug)
}

export function isPhotoPathname(pathname: string) {
  return pathname.startsWith(PHOTO_PATH_PREFIX)
}
