import { thumbHashToDataURL } from 'thumbhash'

const CACHE_LIMIT = 128

const dataUrlCache = new Map<string, string>()

function decodeBase64(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

export function getThumbHashDataUrl(thumbHash: string) {
  const cached = dataUrlCache.get(thumbHash)

  if (cached) {
    dataUrlCache.delete(thumbHash)
    dataUrlCache.set(thumbHash, cached)

    return cached
  }

  const dataUrl = thumbHashToDataURL(decodeBase64(thumbHash))

  if (dataUrlCache.size >= CACHE_LIMIT) {
    const oldest = dataUrlCache.keys().next()

    if (!oldest.done) {
      dataUrlCache.delete(oldest.value)
    }
  }

  dataUrlCache.set(thumbHash, dataUrl)

  return dataUrl
}
