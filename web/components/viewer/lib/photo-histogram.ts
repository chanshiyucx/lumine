export const BIN_COUNT = 128
const MAX_HISTOGRAM_CACHE_SIZE = 50

export type Channel = 'red' | 'green' | 'blue' | 'luminance'
export type HistogramBins = Record<Channel, number[]>

const histogramCache = new Map<string, HistogramBins>()
const histogramRequests = new Map<string, Promise<HistogramBins>>()

export function peekHistogram(key: string) {
  return histogramCache.get(key) ?? null
}

export function createHistogramBins(): HistogramBins {
  return {
    blue: new Array<number>(BIN_COUNT).fill(0),
    green: new Array<number>(BIN_COUNT).fill(0),
    luminance: new Array<number>(BIN_COUNT).fill(0),
    red: new Array<number>(BIN_COUNT).fill(0),
  }
}

function calculateHistogram(imageData: ImageData): HistogramBins {
  const bins = createHistogramBins()

  const { data } = imageData
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0
    const g = data[i + 1] ?? 0
    const b = data[i + 2] ?? 0

    bins.red[r >> 1] = (bins.red[r >> 1] ?? 0) + 1
    bins.green[g >> 1] = (bins.green[g >> 1] ?? 0) + 1
    bins.blue[b >> 1] = (bins.blue[b >> 1] ?? 0) + 1

    const luminance = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)
    bins.luminance[luminance >> 1] = (bins.luminance[luminance >> 1] ?? 0) + 1
  }

  return bins
}

function cacheHistogram(key: string, bins: HistogramBins): void {
  histogramCache.delete(key)
  if (histogramCache.size >= MAX_HISTOGRAM_CACHE_SIZE) {
    const oldestKey = histogramCache.keys().next().value
    if (oldestKey) {
      histogramCache.delete(oldestKey)
    }
  }
  histogramCache.set(key, bins)
}

function getCachedHistogram(key: string): HistogramBins | null {
  const bins = histogramCache.get(key)
  if (!bins) {
    return null
  }

  histogramCache.delete(key)
  histogramCache.set(key, bins)
  return bins
}

async function computeHistogram(key: string): Promise<HistogramBins> {
  const response = await fetch(key)
  if (!response.ok) {
    throw new Error(`Failed to fetch thumbnail: ${response.status}`)
  }

  const blob = await response.blob()
  let imageBitmap: ImageBitmap | null = null
  let imageSource: ImageBitmap | HTMLImageElement

  if (typeof createImageBitmap === 'function') {
    imageBitmap = await createImageBitmap(blob)
    imageSource = imageBitmap
  } else {
    const objectUrl = URL.createObjectURL(blob)
    const image = new Image()

    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('Failed to decode image'))
        image.src = objectUrl
      })
    } finally {
      URL.revokeObjectURL(objectUrl)
    }

    imageSource = image
  }

  try {
    const sourceWidth =
      imageSource instanceof HTMLImageElement
        ? imageSource.naturalWidth
        : imageSource.width
    const sourceHeight =
      imageSource instanceof HTMLImageElement
        ? imageSource.naturalHeight
        : imageSource.height
    const maxSize = 240
    const scale = Math.min(1, maxSize / sourceWidth, maxSize / sourceHeight)
    const scaledWidth = Math.max(1, Math.floor(sourceWidth * scale))
    const scaledHeight = Math.max(1, Math.floor(sourceHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = scaledWidth
    canvas.height = scaledHeight

    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      throw new Error('Failed to create histogram canvas context')
    }

    context.drawImage(imageSource, 0, 0, scaledWidth, scaledHeight)
    return calculateHistogram(
      context.getImageData(0, 0, scaledWidth, scaledHeight),
    )
  } finally {
    imageBitmap?.close()
  }
}

export function getHistogram(key: string): Promise<HistogramBins> {
  const cachedBins = getCachedHistogram(key)
  if (cachedBins) {
    return Promise.resolve(cachedBins)
  }

  const pendingRequest = histogramRequests.get(key)
  if (pendingRequest) {
    return pendingRequest
  }

  const request = computeHistogram(key).then((bins) => {
    cacheHistogram(key, bins)
    return bins
  })
  histogramRequests.set(key, request)

  const removeRequest = () => {
    if (histogramRequests.get(key) === request) {
      histogramRequests.delete(key)
    }
  }
  void request.then(removeRequest, removeRequest)

  return request
}
