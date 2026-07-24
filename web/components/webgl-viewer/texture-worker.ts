/// <reference lib="webworker" />

let originalImage: ImageBitmap | null = null

const TILE_SIZE = 512

self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data

  if (type === 'init') {
    try {
      originalImage?.close()
      const nextImage = payload.imageBitmap as ImageBitmap
      originalImage = nextImage

      const canvas = new OffscreenCanvas(
        payload.previewWidth,
        payload.previewHeight,
      )
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Failed to create preview canvas context')
      }

      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'medium'
      context.drawImage(
        nextImage,
        0,
        0,
        payload.previewWidth,
        payload.previewHeight,
      )

      const previewBitmap = canvas.transferToImageBitmap()
      self.postMessage({ type: 'init-done', payload: { previewBitmap } }, [
        previewBitmap,
      ])
    } catch (error) {
      self.postMessage({
        type: 'init-error',
        payload: {
          message:
            error instanceof Error
              ? error.message
              : 'Failed to initialize texture worker',
        },
      })
    }
  } else if (type === 'create-tile') {
    const { x, y, lodLevel, lodConfig, imageWidth, imageHeight, key } = payload

    if (!originalImage) {
      self.postMessage({
        type: 'tile-error',
        payload: {
          key,
          error: 'Worker has not been initialized with an image',
        },
      })
      return
    }

    try {
      const { cols, rows } = getTileGridSize(
        imageWidth,
        imageHeight,
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
        throw new Error('Tile dimensions must be positive')
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
      self.postMessage({
        type: 'tile-error',
        payload: {
          key,
          error: error instanceof Error ? error.message : 'Failed to create tile',
        },
      })
    }
  }
}

function getTileGridSize(
  imageWidth: number,
  imageHeight: number,
  lodConfig: { scale: number },
): { cols: number; rows: number } {
  const scaledWidth = imageWidth * lodConfig.scale
  const scaledHeight = imageHeight * lodConfig.scale

  const cols = Math.ceil(scaledWidth / TILE_SIZE)
  const rows = Math.ceil(scaledHeight / TILE_SIZE)

  return { cols, rows }
}

export {}
