const MAX_CACHED_PHOTOS = 12
const cachedPhotoUrls = new Map<string, string>()

export function peekCachedPhotoUrl(url: string) {
  return cachedPhotoUrls.get(url) ?? null
}

export function getCachedPhotoUrl(url: string) {
  const objectUrl = cachedPhotoUrls.get(url)

  if (!objectUrl) {
    return null
  }

  cachedPhotoUrls.delete(url)
  cachedPhotoUrls.set(url, objectUrl)

  return objectUrl
}

export function setCachedPhotoUrl(url: string, objectUrl: string) {
  const existingObjectUrl = cachedPhotoUrls.get(url)

  if (existingObjectUrl && existingObjectUrl !== objectUrl) {
    URL.revokeObjectURL(existingObjectUrl)
  }

  cachedPhotoUrls.delete(url)
  cachedPhotoUrls.set(url, objectUrl)

  while (cachedPhotoUrls.size > MAX_CACHED_PHOTOS) {
    const oldestEntry = cachedPhotoUrls.entries().next().value

    if (!oldestEntry) {
      break
    }

    const [oldestUrl, oldestObjectUrl] = oldestEntry
    cachedPhotoUrls.delete(oldestUrl)
    URL.revokeObjectURL(oldestObjectUrl)
  }
}
