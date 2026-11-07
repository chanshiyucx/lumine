export function normalizePathSegment(pathSegment: string) {
  return pathSegment.normalize('NFC')
}

// Next.js re-encodes dynamic params for page components, while generateMetadata
// and metadata image routes receive them decoded. Removing this from a page
// breaks only non-ASCII routes. See docs/web/047-可读名称路由方案.md.
export function decodeEncodedPathSegment(pathSegment: string) {
  try {
    return normalizePathSegment(decodeURIComponent(pathSegment))
  } catch {
    return normalizePathSegment(pathSegment)
  }
}

export function encodePathSegment(pathSegment: string) {
  return encodeURIComponent(normalizePathSegment(pathSegment))
}
