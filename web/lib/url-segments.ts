export function normalizePathSegment(pathSegment: string) {
  return pathSegment.normalize('NFC')
}

export function decodeRawPathSegment(pathSegment: string) {
  try {
    return normalizePathSegment(decodeURIComponent(pathSegment))
  } catch {
    return normalizePathSegment(pathSegment)
  }
}

export function encodePathSegment(pathSegment: string) {
  return encodeURIComponent(normalizePathSegment(pathSegment))
}
