import { siteConfig } from '../site-config'
import { encodePathSegment } from '../url-segments'
import { getPhotoPath } from '.'

const PHOTO_OG_VERSION = 6

function getRuntimeOrigin() {
  return typeof window !== 'undefined' ? window.location.origin : siteConfig.host
}

export function getPhotoShareUrl(slug: string) {
  return new URL(getPhotoPath(slug), getRuntimeOrigin()).toString()
}

export function getPhotoOgPath(slug: string) {
  return `/og/${encodePathSegment(slug)}?v=${PHOTO_OG_VERSION}`
}

export function getPhotoOgUrl(slug: string) {
  return new URL(getPhotoOgPath(slug), getRuntimeOrigin()).toString()
}
