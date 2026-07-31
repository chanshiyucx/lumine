const MAX_CACHED_PHOTOS = 10

export class ObjectUrlLruCache {
  readonly #entries = new Map<string, string>()
  readonly #maxSize: number
  readonly #revoke: (url: string) => void

  constructor(
    maxSize = MAX_CACHED_PHOTOS,
    revoke: (url: string) => void = URL.revokeObjectURL,
  ) {
    this.#maxSize = maxSize
    this.#revoke = revoke
  }

  peek(key: string) {
    return this.#entries.get(key) ?? null
  }

  get(key: string) {
    const value = this.#entries.get(key)

    if (!value) {
      return null
    }

    this.#entries.delete(key)
    this.#entries.set(key, value)

    return value
  }

  set(key: string, value: string) {
    const previous = this.#entries.get(key)

    if (previous && previous !== value) {
      this.#revoke(previous)
    }

    this.#entries.delete(key)
    this.#entries.set(key, value)

    while (this.#entries.size > this.#maxSize) {
      const oldest = this.#entries.entries().next().value
      if (!oldest) {
        return
      }

      this.#entries.delete(oldest[0])
      this.#revoke(oldest[1])
    }
  }

  clear() {
    for (const value of this.#entries.values()) {
      this.#revoke(value)
    }
    this.#entries.clear()
  }
}

const photoCache = new ObjectUrlLruCache()

export function peekCachedPhotoUrl(url: string) {
  return photoCache.peek(url)
}

export function getCachedPhotoUrl(url: string) {
  return photoCache.get(url)
}

export function setCachedPhotoUrl(url: string, objectUrl: string) {
  photoCache.set(url, objectUrl)
}
