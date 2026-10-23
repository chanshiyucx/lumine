import { decodeEncodedPathSegment, encodePathSegment } from './url-segments'

const ALBUM_PATH_PREFIX = '/albums/'
const PHOTO_PATH_PREFIX = '/photos/'

export const PRIVATE_PATH = '/private'

export type PhotoScope = 'public' | 'private'

const GALLERY_PATHS: Record<PhotoScope, string> = {
  public: '/',
  private: PRIVATE_PATH,
}

const PHOTO_PATH_PREFIXES: Record<PhotoScope, string> = {
  public: PHOTO_PATH_PREFIX,
  private: `${PRIVATE_PATH}${PHOTO_PATH_PREFIX}`,
}

export function getAlbumPath(albumId: string) {
  return `${ALBUM_PATH_PREFIX}${encodePathSegment(albumId)}`
}

export function getGalleryPath(scope: PhotoScope) {
  return GALLERY_PATHS[scope]
}

export function getPhotoPath(photoId: string, scope: PhotoScope = 'public') {
  return `${PHOTO_PATH_PREFIXES[scope]}${encodePathSegment(photoId)}`
}

export function getPhotoOgPath(photoId: string) {
  return `${getPhotoPath(photoId)}/opengraph-image`
}

export function getPhotoSlugFromPathname(
  pathname: string,
  scope: PhotoScope = 'public',
) {
  if (!isPhotoPathname(pathname, scope)) {
    return null
  }

  const rawSlug = pathname.slice(PHOTO_PATH_PREFIXES[scope].length)

  if (!rawSlug || rawSlug.includes('/')) {
    return null
  }

  return decodeEncodedPathSegment(rawSlug)
}

export function isPhotoPathname(
  pathname: string,
  scope: PhotoScope = 'public',
) {
  return pathname.startsWith(PHOTO_PATH_PREFIXES[scope])
}
