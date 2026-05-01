interface CachedPhotoResource {
  blob: Blob
  objectUrl: string
  totalBytes: number | null
}

const MAX_CACHED_PHOTOS = 12
const cachedPhotoResources = new Map<string, CachedPhotoResource>()

export function peekCachedPhotoResource(url: string) {
  return cachedPhotoResources.get(url) ?? null
}

export function getCachedPhotoResource(url: string) {
  const cachedResource = cachedPhotoResources.get(url)

  if (!cachedResource) {
    return null
  }

  cachedPhotoResources.delete(url)
  cachedPhotoResources.set(url, cachedResource)

  return cachedResource
}

export function setCachedPhotoResource(
  url: string,
  resource: CachedPhotoResource,
) {
  const existingResource = cachedPhotoResources.get(url)

  if (existingResource && existingResource.objectUrl !== resource.objectUrl) {
    URL.revokeObjectURL(existingResource.objectUrl)
  }

  cachedPhotoResources.delete(url)
  cachedPhotoResources.set(url, resource)

  while (cachedPhotoResources.size > MAX_CACHED_PHOTOS) {
    const oldestEntry = cachedPhotoResources.entries().next().value

    if (!oldestEntry) {
      break
    }

    const [oldestUrl, oldestResource] = oldestEntry
    cachedPhotoResources.delete(oldestUrl)
    URL.revokeObjectURL(oldestResource.objectUrl)
  }
}
