import { thumbHashToAverageRGBA, thumbHashToDataURL } from 'thumbhash'

const CACHE_LIMIT = 128

export interface ThumbHashAsset {
  dataUrl: string
  averageColor: {
    r: number
    g: number
    b: number
    a: number
  }
}

const assetCache = new Map<string, ThumbHashAsset>()

function decodeBase64(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function decodeThumbHash(thumbHash: string): ThumbHashAsset {
  const bytes = decodeBase64(thumbHash)

  return {
    dataUrl: thumbHashToDataURL(bytes),
    averageColor: thumbHashToAverageRGBA(bytes),
  }
}

export function getThumbHashAsset(thumbHash: string) {
  const cached = assetCache.get(thumbHash)

  if (cached) {
    assetCache.delete(thumbHash)
    assetCache.set(thumbHash, cached)

    return cached
  }

  const asset = decodeThumbHash(thumbHash)

  if (assetCache.size >= CACHE_LIMIT) {
    const oldest = assetCache.keys().next()

    if (!oldest.done) {
      assetCache.delete(oldest.value)
    }
  }

  assetCache.set(thumbHash, asset)

  return asset
}
