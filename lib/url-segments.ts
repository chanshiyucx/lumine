export function normalizePathSegment(pathSegment: string) {
  return pathSegment.normalize('NFC')
}

export function decodePathSegment(pathSegment: string) {
  try {
    return normalizePathSegment(decodeURIComponent(pathSegment))
  } catch {
    return normalizePathSegment(pathSegment)
  }
}

export function encodePathSegment(pathSegment: string) {
  return encodeURIComponent(normalizePathSegment(pathSegment))
}
