import { getPhotoPath } from '../route-paths'
import { siteConfig } from '../site-config'

function getRuntimeOrigin() {
  return typeof window !== 'undefined'
    ? window.location.origin
    : siteConfig.host
}

export function getPhotoShareUrl(slug: string) {
  return new URL(getPhotoPath(slug), getRuntimeOrigin()).toString()
}
