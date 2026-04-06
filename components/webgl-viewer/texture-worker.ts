/// <reference lib="webworker" />

let originalImage: ImageBitmap | null = null

const TILE_SIZE = 512

self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data

  if (type === 'init') {
    originalImage = payload.imageBitmap
    self.postMessage({ type: 'init-done' })
  } else if (type === 'create-tile') {
    if (!originalImage) {
      console.warn('Worker has not been initialized with an image.')
      return
    }

    const { x, y, lodLevel, lodConfig, imageWidth, imageHeight, key } = payload

    try {
      const { cols, rows } = getTileGridSize(
        imageWidth,
        imageHeight,
        lodLevel,
        lodConfig,
      )

      const sourceWidth = imageWidth / cols
      const sourceHeight = imageHeight / rows
      const sourceX = x * sourceWidth
      const sourceY = y * sourceHeight

      const actualSourceWidth = Math.min(sourceWidth, imageWidth - sourceX)
      const actualSourceHeight = Math.min(sourceHeight, imageHeight - sourceY)

      const targetWidth = Math.min(
        TILE_SIZE,
        Math.ceil(actualSourceWidth * lodConfig.scale),
      )
      const targetHeight = Math.min(
        TILE_SIZE,
        Math.ceil(actualSourceHeight * lodConfig.scale),
      )

      if (targetWidth <= 0 || targetHeight <= 0) {
        return
      }

      const canvas = new OffscreenCanvas(targetWidth, targetHeight)
      const context = canvas.getContext('2d')!

      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = lodConfig.scale >= 1 ? 'high' : 'medium'

      context.drawImage(
        originalImage,
        sourceX,
        sourceY,
        actualSourceWidth,
        actualSourceHeight,
        0,
        0,
        targetWidth,
        targetHeight,
      )

      const imageBitmap = canvas.transferToImageBitmap()
      self.postMessage(
        { type: 'tile-created', payload: { key, imageBitmap, lodLevel } },
        [imageBitmap],
      )
    } catch (error) {
      console.error('Error creating tile in worker:', error)
      self.postMessage({ type: 'tile-error', payload: { key, error } })
    }
  }
}

function getTileGridSize(
  imageWidth: number,
  imageHeight: number,
  _lodLevel: number,
  lodConfig: { scale: number },
): { cols: number; rows: number } {
  const scaledWidth = imageWidth * lodConfig.scale
  const scaledHeight = imageHeight * lodConfig.scale

  const cols = Math.ceil(scaledWidth / TILE_SIZE)
  const rows = Math.ceil(scaledHeight / TILE_SIZE)

  return { cols, rows }
}

export {}
