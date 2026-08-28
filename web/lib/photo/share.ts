import { getPhotoPath } from '.'
import { siteConfig } from '../site-config'

function getRuntimeOrigin() {
  return typeof window !== 'undefined'
    ? window.location.origin
    : siteConfig.host
}

export function getPhotoShareUrl(slug: string) {
  return new URL(getPhotoPath(slug), getRuntimeOrigin()).toString()
}

export function getPhotoOgPath(slug: string) {
  return `${getPhotoPath(slug)}/opengraph-image`
}
