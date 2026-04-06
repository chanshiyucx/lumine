import type * as React from 'react'
import { ImageViewerEngineBase } from './image-viewer-engine-base'
import {
  createShader,
  FRAGMENT_SHADER_SOURCE,
  VERTEX_SHADER_SOURCE,
} from './shaders'
import type { DebugInfo, WebGLImageViewerProps } from './types'

const TILE_SIZE = 512
const MAX_TILES_PER_FRAME = 4
const TILE_CACHE_SIZE = 32

interface TileInfo {
  x: number
  y: number
  lodLevel: number
  texture: WebGLTexture | null
  lastUsed: number
  isLoading: boolean
  priority: number
}

type TileKey = string

const SIMPLE_LOD_LEVELS = [
  { scale: 0.25 },
  { scale: 0.5 },
  { scale: 1 },
  { scale: 2 },
  { scale: 4 },
] as const

export class WebGLImageViewerEngine extends ImageViewerEngineBase {
  private canvas: HTMLCanvasElement
  private gl: WebGLRenderingContext
  private program!: WebGLProgram
  private texture: WebGLTexture | null = null
  private imageLoaded = false
  private originalImageSrc = ''

  private scale = 1
  private translateX = 0
  private translateY = 0
  private imageWidth = 0
  private imageHeight = 0
  private canvasWidth = 0
  private canvasHeight = 0
  private devicePixelRatio = 1

  private isDragging = false
  private lastMouseX = 0
  private lastMouseY = 0
  private lastTouchDistance = 0
  private lastDoubleClickTime = 0
  private isOriginalSize = false

  private lastTouchTime = 0
  private lastTouchX = 0
  private lastTouchY = 0

  private isAnimating = false
  private animationStartTime = 0
  private animationDuration = 300
  private startScale = 1
  private targetScale = 1
  private startTranslateX = 0
  private startTranslateY = 0
  private targetTranslateX = 0
  private targetTranslateY = 0
  private animationStartLOD = -1

  private originalImage: HTMLImageElement | null = null
  private currentLOD = 1
  private lodTextures = new Map<number, WebGLTexture>()

  private config: Required<WebGLImageViewerProps>
  private onZoomChange?: (originalScale: number, relativeScale: number) => void
  private onImageCopied?: () => void
  private onLoadingStateChange?: (
    isLoading: boolean,
    message?: string,
    quality?: 'high' | 'medium' | 'low' | 'unknown',
  ) => void
  private onDebugUpdate?: React.RefObject<{
    updateDebugInfo: (debugInfo: DebugInfo) => void
  } | null>

  private currentQuality: 'high' | 'medium' | 'low' | 'unknown' = 'unknown'
  private isLoadingTexture = true
  private worker: Worker | null = null
  private textureWorkerInitialized = false

  private boundHandleMouseDown: (event: MouseEvent) => void
  private boundHandleMouseMove: (event: MouseEvent) => void
  private boundHandleMouseUp: () => void
  private boundHandleWheel: (event: WheelEvent) => void
  private boundHandleDoubleClick: (event: MouseEvent) => void
  private boundHandleTouchStart: (event: TouchEvent) => void
  private boundHandleTouchMove: (event: TouchEvent) => void
  private boundHandleTouchEnd: (event: TouchEvent) => void
  private boundResizeCanvas: () => void

  private tileCache = new Map<TileKey, TileInfo>()
  private loadingTiles = new Map<TileKey, { priority: number }>()
  private pendingTileRequests: Array<{ key: TileKey; priority: number }> = []

  private currentVisibleTiles = new Set<TileKey>()
  private lastViewportHash = ''
  private resizeObserver: ResizeObserver | null = null
  private lastTileUpdateTime = 0

  constructor(
    canvas: HTMLCanvasElement,
    config: Required<WebGLImageViewerProps>,
    onDebugUpdate?: React.RefObject<{
      updateDebugInfo: (debugInfo: DebugInfo) => void
    } | null>,
  ) {
    super()
    this.canvas = canvas
    this.config = config
    this.onZoomChange = config.onZoomChange
    this.onImageCopied = config.onImageCopied
    this.onLoadingStateChange = config.onLoadingStateChange
    this.onDebugUpdate = onDebugUpdate

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
      powerPreference: 'default',
    })

    if (!gl) {
      throw new Error('WebGL not supported')
    }

    this.gl = gl

    this.boundHandleMouseDown = (event: MouseEvent) =>
      this.handleMouseDown(event)
    this.boundHandleMouseMove = (event: MouseEvent) =>
      this.handleMouseMove(event)
    this.boundHandleMouseUp = () => this.handleMouseUp()
    this.boundHandleWheel = (event: WheelEvent) => this.handleWheel(event)
    this.boundHandleDoubleClick = (event: MouseEvent) =>
      this.handleDoubleClick(event)
    this.boundHandleTouchStart = (event: TouchEvent) =>
      this.handleTouchStart(event)
    this.boundHandleTouchMove = (event: TouchEvent) =>
      this.handleTouchMove(event)
    this.boundHandleTouchEnd = () => this.handleTouchEnd()
    this.boundResizeCanvas = () => this.resizeCanvas()

    this.setupCanvas()
    this.initWebGL()
    this.initWorker()
    this.setupEventListeners()

    this.isLoadingTexture = false
    this.notifyLoadingStateChange(false)
  }

  private setupCanvas() {
    this.resizeCanvas()
    window.addEventListener('resize', this.boundResizeCanvas)

    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]?.target !== this.canvas) {
        return
      }

      this.boundResizeCanvas()
    })

    this.resizeObserver.observe(this.canvas)
  }

  private resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect()
    this.devicePixelRatio = window.devicePixelRatio || 1
    this.canvasWidth = rect.width
    this.canvasHeight = rect.height

    const actualWidth = Math.round(rect.width * this.devicePixelRatio)
    const actualHeight = Math.round(rect.height * this.devicePixelRatio)

    this.canvas.width = actualWidth
    this.canvas.height = actualHeight
    this.gl.viewport(0, 0, actualWidth, actualHeight)

    if (!this.imageLoaded) {
      return
    }

    this.constrainScaleAndPosition()
    this.render()
    this.notifyZoomChange()
  }

  private initWebGL() {
    const { gl } = this

    const vertexShader = createShader(
      gl,
      gl.VERTEX_SHADER,
      VERTEX_SHADER_SOURCE,
    )
    const fragmentShader = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      FRAGMENT_SHADER_SOURCE,
    )

    this.program = gl.createProgram()!
    gl.attachShader(this.program, vertexShader)
    gl.attachShader(this.program, fragmentShader)
    gl.linkProgram(this.program)

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error(
        `Program linking failed: ${gl.getProgramInfoLog(this.program)}`,
      )
    }

    gl.useProgram(this.program)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    const positions = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ])
    const texCoords = new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0])

    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

    const positionLocation = gl.getAttribLocation(this.program, 'a_position')
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    const texCoordBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW)

    const texCoordLocation = gl.getAttribLocation(this.program, 'a_texCoord')
    gl.enableVertexAttribArray(texCoordLocation)
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0)
  }

  private initWorker() {
    this.worker = new Worker(new URL('./texture-worker.ts', import.meta.url), {
      name: 'texture-worker',
      type: 'module',
    })

    this.worker.onmessage = (event: MessageEvent) => {
      this.handleWorkerMessage(event)
    }
  }

  private handleWorkerMessage(event: MessageEvent) {
    const { type, payload } = event.data

    if (type === 'init-done') {
      this.textureWorkerInitialized = true
      this.updateTileCache()
      return
    }

    if (type === 'tile-created') {
      const { key, imageBitmap, lodLevel } = payload
      const loadingInfo = this.loadingTiles.get(key)
      const tileInfoInCache = this.tileCache.get(key)

      if (!this.currentVisibleTiles.has(key)) {
        imageBitmap.close()
        if (loadingInfo) {
          this.loadingTiles.delete(key)
        }
        return
      }

      const texture = this.createWebGLTexture(imageBitmap)
      imageBitmap.close()

      if (texture) {
        const [x, y] = key.split('-').map(Number)
        const tileInfo: TileInfo = {
          x,
          y,
          lodLevel,
          texture,
          lastUsed: performance.now(),
          isLoading: false,
          priority: loadingInfo
            ? loadingInfo.priority
            : tileInfoInCache
              ? tileInfoInCache.priority
              : 0,
        }
        this.tileCache.set(key, tileInfo)

        if (loadingInfo) {
          this.loadingTiles.delete(key)
        }

        if (this.currentVisibleTiles.has(key)) {
          this.render()
        }
      } else if (loadingInfo) {
        this.loadingTiles.delete(key)
      }
    } else if (type === 'tile-error') {
      const { key, error } = payload
      console.warn(`Worker failed to create tile: ${key}`, error)
      this.loadingTiles.delete(key)
    }
  }

  async loadImage(
    url: string,
    preknownWidth?: number,
    preknownHeight?: number,
  ) {
    this.originalImageSrc = url
    this.isLoadingTexture = true
    this.notifyLoadingStateChange(true, 'Loading...')

    if (preknownWidth && preknownHeight) {
      this.imageWidth = preknownWidth
      this.imageHeight = preknownHeight
      this.setupInitialScaling()
    }

    const image = new Image()
    image.crossOrigin = 'anonymous'

    return new Promise<void>((resolve, reject) => {
      image.onload = async () => {
        try {
          if (!preknownWidth || !preknownHeight) {
            this.imageWidth = image.width
            this.imageHeight = image.height
            this.setupInitialScaling()
          }

          this.notifyLoadingStateChange(true, 'Creating texture...')
          await this.createTexture(image)

          const imageBitmap = await createImageBitmap(image)
          this.worker?.postMessage(
            {
              type: 'init',
              payload: { imageBitmap },
            },
            [imageBitmap],
          )

          this.imageLoaded = true
          this.isLoadingTexture = false
          this.notifyLoadingStateChange(false)
          this.render()
          this.notifyZoomChange()
          resolve()
        } catch (error) {
          this.isLoadingTexture = false
          this.notifyLoadingStateChange(false)
          reject(error)
        }
      }

      image.onerror = () => {
        this.isLoadingTexture = false
        this.notifyLoadingStateChange(false)
        reject(new Error('Failed to load image'))
      }

      image.src = url
    })
  }

  private setupInitialScaling() {
    if (this.config.centerOnInit) {
      this.fitImageToScreen()
    } else {
      const fitToScreenScale = this.getFitToScreenScale()
      this.scale = fitToScreenScale * this.config.initialScale
    }
  }

  private async createTexture(image: HTMLImageElement) {
    this.originalImage = image
    await this.createLODTexture(this.currentLOD)
  }

  private async createLODTexture(lodLevel: number) {
    if (
      !this.originalImage ||
      lodLevel < 0 ||
      lodLevel >= SIMPLE_LOD_LEVELS.length
    ) {
      return
    }

    const lodConfig = SIMPLE_LOD_LEVELS[lodLevel]
    const finalWidth = Math.max(
      1,
      Math.round(this.originalImage.width * lodConfig.scale),
    )
    const finalHeight = Math.max(
      1,
      Math.round(this.originalImage.height * lodConfig.scale),
    )

    const canvas = document.createElement('canvas')
    canvas.width = finalWidth
    canvas.height = finalHeight
    const context = canvas.getContext('2d')!

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = lodConfig.scale >= 1 ? 'high' : 'medium'
    context.drawImage(this.originalImage, 0, 0, finalWidth, finalHeight)

    const texture = this.createWebGLTexture(canvas)
    if (!texture) {
      return
    }

    this.cleanupLODTextures()
    this.lodTextures.set(lodLevel, texture)
    this.texture = texture
    this.currentLOD = lodLevel
    this.currentQuality =
      lodConfig.scale >= 2 ? 'high' : lodConfig.scale >= 1 ? 'medium' : 'low'
  }

  private createWebGLTexture(
    source: HTMLCanvasElement | HTMLImageElement | ImageBitmap,
  ): WebGLTexture | null {
    const { gl } = this
    const texture = gl.createTexture()

    if (!texture) {
      return null
    }

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)

    return texture
  }

  private cleanupLODTextures() {
    for (const texture of this.lodTextures.values()) {
      this.gl.deleteTexture(texture)
    }

    this.lodTextures.clear()
  }

  private selectOptimalLOD(): number {
    if (this.isAnimating && this.animationStartLOD > -1) {
      return this.animationStartLOD
    }

    if (!this.imageLoaded) {
      return 1
    }

    const requiredScale = this.scale * this.devicePixelRatio

    for (const [index, lod] of SIMPLE_LOD_LEVELS.entries()) {
      if (lod.scale >= requiredScale) {
        return index
      }
    }

    return SIMPLE_LOD_LEVELS.length - 1
  }

  private easeOutQuart(t: number) {
    return 1 - Math.pow(1 - t, 4)
  }

  private startAnimation(
    targetScale: number,
    targetTranslateX: number,
    targetTranslateY: number,
    animationTime?: number,
  ) {
    this.isAnimating = true
    this.animationStartTime = performance.now()
    this.animationDuration = animationTime || (this.config.smooth ? 300 : 0)
    this.startScale = this.scale
    this.targetScale = targetScale
    this.startTranslateX = this.translateX
    this.startTranslateY = this.translateY
    this.targetTranslateX = targetTranslateX
    this.targetTranslateY = targetTranslateY
    this.animationStartLOD = this.selectOptimalLOD()

    const tempScale = this.scale
    const tempTranslateX = this.translateX
    const tempTranslateY = this.translateY

    this.scale = targetScale
    this.translateX = targetTranslateX
    this.translateY = targetTranslateY
    this.constrainImagePosition()

    this.targetTranslateX = this.translateX
    this.targetTranslateY = this.translateY

    this.scale = tempScale
    this.translateX = tempTranslateX
    this.translateY = tempTranslateY

    this.animate()
  }

  private animate() {
    if (!this.isAnimating) {
      return
    }

    const now = performance.now()
    const elapsed = now - this.animationStartTime
    const progress = Math.min(elapsed / this.animationDuration, 1)
    const easedProgress = this.config.smooth
      ? this.easeOutQuart(progress)
      : progress

    this.scale =
      this.startScale + (this.targetScale - this.startScale) * easedProgress
    this.translateX =
      this.startTranslateX +
      (this.targetTranslateX - this.startTranslateX) * easedProgress
    this.translateY =
      this.startTranslateY +
      (this.targetTranslateY - this.startTranslateY) * easedProgress

    this.render()
    this.notifyZoomChange()

    if (progress < 1) {
      requestAnimationFrame(() => this.animate())
      return
    }

    this.isAnimating = false
    this.animationStartLOD = -1
    this.scale = this.targetScale
    this.translateX = this.targetTranslateX
    this.translateY = this.targetTranslateY
    this.render()
    this.notifyZoomChange()
    this.updateTileCache()
  }

  private fitImageToScreen() {
    const scaleX = this.canvasWidth / this.imageWidth
    const scaleY = this.canvasHeight / this.imageHeight
    const fitToScreenScale = Math.min(scaleX, scaleY)

    this.scale = fitToScreenScale * this.config.initialScale
    this.translateX = 0
    this.translateY = 0
    this.isOriginalSize = false
  }

  private createMatrix(): Float32Array {
    const scaleX = (this.imageWidth * this.scale) / this.canvasWidth
    const scaleY = (this.imageHeight * this.scale) / this.canvasHeight
    const translateX = (this.translateX * 2) / this.canvasWidth
    const translateY = -(this.translateY * 2) / this.canvasHeight

    return new Float32Array([
      scaleX,
      0,
      0,
      0,
      scaleY,
      0,
      translateX,
      translateY,
      1,
    ])
  }

  private getFitToScreenScale() {
    const scaleX = this.canvasWidth / this.imageWidth
    const scaleY = this.canvasHeight / this.imageHeight
    return Math.min(scaleX, scaleY)
  }

  private constrainImagePosition() {
    if (!this.config.limitToBounds) {
      return
    }

    const fitScale = this.getFitToScreenScale()

    if (this.scale <= fitScale) {
      this.translateX = 0
      this.translateY = 0
      return
    }

    const scaledWidth = this.imageWidth * this.scale
    const scaledHeight = this.imageHeight * this.scale
    const maxTranslateX = Math.max(0, (scaledWidth - this.canvasWidth) / 2)
    const maxTranslateY = Math.max(0, (scaledHeight - this.canvasHeight) / 2)

    this.translateX = Math.max(
      -maxTranslateX,
      Math.min(maxTranslateX, this.translateX),
    )
    this.translateY = Math.max(
      -maxTranslateY,
      Math.min(maxTranslateY, this.translateY),
    )
  }

  private constrainScaleAndPosition() {
    const fitToScreenScale = this.getFitToScreenScale()
    const absoluteMinScale = fitToScreenScale * this.config.minScale
    const originalSizeScale = 1
    const userMaxScale = fitToScreenScale * this.config.maxScale
    const effectiveMaxScale = Math.max(userMaxScale, originalSizeScale)

    if (this.scale < absoluteMinScale) {
      this.scale = absoluteMinScale
    } else if (this.scale > effectiveMaxScale) {
      this.scale = effectiveMaxScale
    }

    this.constrainImagePosition()
  }

  private getTileKey(x: number, y: number, lodLevel: number): TileKey {
    return `${x}-${y}-${lodLevel}`
  }

  private getTileGridSize(lodLevel: number): { cols: number; rows: number } {
    const lodConfig = SIMPLE_LOD_LEVELS[lodLevel]
    const scaledWidth = this.imageWidth * lodConfig.scale
    const scaledHeight = this.imageHeight * lodConfig.scale

    return {
      cols: Math.ceil(scaledWidth / TILE_SIZE),
      rows: Math.ceil(scaledHeight / TILE_SIZE),
    }
  }

  private calculateVisibleTiles() {
    if (!this.imageLoaded) {
      return [] as Array<{
        x: number
        y: number
        lodLevel: number
        priority: number
      }>
    }

    const lodLevel = this.selectOptimalLOD()
    const { cols, rows } = this.getTileGridSize(lodLevel)

    const imageCenterInCanvasX = this.canvasWidth / 2 + this.translateX
    const imageCenterInCanvasY = this.canvasHeight / 2 + this.translateY
    const scaledImageWidth = this.imageWidth * this.scale
    const scaledImageHeight = this.imageHeight * this.scale
    const imageLeftInCanvas = imageCenterInCanvasX - scaledImageWidth / 2
    const imageTopInCanvas = imageCenterInCanvasY - scaledImageHeight / 2

    const viewLeft = Math.max(0, -imageLeftInCanvas / this.scale)
    const viewTop = Math.max(0, -imageTopInCanvas / this.scale)
    const viewRight = Math.min(
      this.imageWidth,
      (this.canvasWidth - imageLeftInCanvas) / this.scale,
    )
    const viewBottom = Math.min(
      this.imageHeight,
      (this.canvasHeight - imageTopInCanvas) / this.scale,
    )

    const tileWidthInImage = this.imageWidth / cols
    const tileHeightInImage = this.imageHeight / rows
    const margin = 1
    const startTileX = Math.max(
      0,
      Math.floor(viewLeft / tileWidthInImage) - margin,
    )
    const endTileX = Math.min(
      cols - 1,
      Math.ceil(viewRight / tileWidthInImage) + margin,
    )
    const startTileY = Math.max(
      0,
      Math.floor(viewTop / tileHeightInImage) - margin,
    )
    const endTileY = Math.min(
      rows - 1,
      Math.ceil(viewBottom / tileHeightInImage) + margin,
    )

    const visibleTiles: Array<{
      x: number
      y: number
      lodLevel: number
      priority: number
    }> = []
    const viewCenterX = (viewLeft + viewRight) / 2
    const viewCenterY = (viewTop + viewBottom) / 2

    for (let y = startTileY; y <= endTileY; y += 1) {
      for (let x = startTileX; x <= endTileX; x += 1) {
        const tileCenterX = (x + 0.5) * tileWidthInImage
        const tileCenterY = (y + 0.5) * tileHeightInImage
        const distance = Math.sqrt(
          Math.pow(tileCenterX - viewCenterX, 2) +
            Math.pow(tileCenterY - viewCenterY, 2),
        )

        visibleTiles.push({
          x,
          y,
          lodLevel,
          priority: distance,
        })
      }
    }

    visibleTiles.sort((a, b) => a.priority - b.priority)
    return visibleTiles
  }

  private async updateTileCache() {
    const visibleTiles = this.calculateVisibleTiles()
    const newVisibleTiles = new Set<TileKey>()
    const viewportHash = `${this.scale.toFixed(3)}-${this.translateX.toFixed(1)}-${this.translateY.toFixed(1)}`

    if (viewportHash === this.lastViewportHash) {
      return
    }

    this.lastViewportHash = viewportHash

    for (const tile of visibleTiles) {
      const key = this.getTileKey(tile.x, tile.y, tile.lodLevel)
      newVisibleTiles.add(key)

      if (!this.tileCache.has(key) && !this.loadingTiles.has(key)) {
        this.pendingTileRequests.push({ key, priority: tile.priority })
      } else if (this.tileCache.has(key)) {
        const tileInfo = this.tileCache.get(key)!
        tileInfo.lastUsed = performance.now()
      }
    }

    this.currentVisibleTiles = newVisibleTiles
    this.cleanupOldTiles()
    this.processPendingTileRequests()
  }

  private cleanupOldTiles() {
    const now = performance.now()
    const maxAge = 30000

    if (this.tileCache.size > TILE_CACHE_SIZE) {
      const tilesToRemove = Array.from(this.tileCache.entries())
        .filter(([key]) => !this.currentVisibleTiles.has(key))
        .sort(([, a], [, b]) => a.lastUsed - b.lastUsed)
        .slice(0, this.tileCache.size - TILE_CACHE_SIZE + 5)

      for (const [key, tileInfo] of tilesToRemove) {
        if (tileInfo.texture) {
          this.gl.deleteTexture(tileInfo.texture)
        }
        this.tileCache.delete(key)
      }
    }

    for (const [key, tileInfo] of this.tileCache.entries()) {
      if (
        !this.currentVisibleTiles.has(key) &&
        now - tileInfo.lastUsed > maxAge
      ) {
        if (tileInfo.texture) {
          this.gl.deleteTexture(tileInfo.texture)
        }
        this.tileCache.delete(key)
      }
    }
  }

  private processPendingTileRequests() {
    if (
      this.pendingTileRequests.length === 0 ||
      !this.worker ||
      !this.textureWorkerInitialized
    ) {
      return
    }

    this.pendingTileRequests.sort((a, b) => a.priority - b.priority)
    const batch = this.pendingTileRequests.splice(0, MAX_TILES_PER_FRAME)

    for (const request of batch) {
      const { key, priority } = request
      if (this.loadingTiles.has(key) || this.tileCache.has(key)) {
        continue
      }

      this.loadingTiles.set(key, { priority })

      const [x, y, lodLevel] = key.split('-').map(Number)
      const lodConfig = SIMPLE_LOD_LEVELS[lodLevel]

      this.worker.postMessage({
        type: 'create-tile',
        payload: {
          x,
          y,
          lodLevel,
          lodConfig,
          imageWidth: this.imageWidth,
          imageHeight: this.imageHeight,
          key,
        },
      })
    }
  }

  private render() {
    const { gl } = this

    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.program)

    const matrixLocation = gl.getUniformLocation(this.program, 'u_matrix')
    const imageLocation = gl.getUniformLocation(this.program, 'u_image')

    if (this.texture) {
      gl.uniformMatrix3fv(matrixLocation, false, this.createMatrix())
      gl.uniform1i(imageLocation, 0)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.texture)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }

    const lodLevel = this.selectOptimalLOD()

    for (const tileKey of this.currentVisibleTiles) {
      const tileInfo = this.tileCache.get(tileKey)
      if (!tileInfo || !tileInfo.texture || tileInfo.lodLevel !== lodLevel) {
        continue
      }

      const tileMatrix = this.createTileMatrix(
        tileInfo.x,
        tileInfo.y,
        tileInfo.lodLevel,
      )
      gl.uniformMatrix3fv(matrixLocation, false, tileMatrix)
      gl.uniform1i(imageLocation, 0)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, tileInfo.texture)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }

    this.updateDebugInfo()

    if (
      !this.isAnimating &&
      performance.now() - this.lastTileUpdateTime > 100
    ) {
      this.lastTileUpdateTime = performance.now()
      setTimeout(() => this.updateTileCache(), 0)
    }
  }

  private createTileMatrix(
    tileX: number,
    tileY: number,
    lodLevel: number,
  ): Float32Array {
    const { cols, rows } = this.getTileGridSize(lodLevel)
    const tileWidthInImage = this.imageWidth / cols
    const tileHeightInImage = this.imageHeight / rows
    const tileLeftInImage = tileX * tileWidthInImage
    const tileTopInImage = tileY * tileHeightInImage
    const tileRightInImage = Math.min(
      this.imageWidth,
      tileLeftInImage + tileWidthInImage,
    )
    const tileBottomInImage = Math.min(
      this.imageHeight,
      tileTopInImage + tileHeightInImage,
    )
    const actualTileWidth = tileRightInImage - tileLeftInImage
    const actualTileHeight = tileBottomInImage - tileTopInImage
    const tileCenterInImageX = tileLeftInImage + actualTileWidth / 2
    const tileCenterInImageY = tileTopInImage + actualTileHeight / 2
    const tileCenterRelativeX = tileCenterInImageX - this.imageWidth / 2
    const tileCenterRelativeY = tileCenterInImageY - this.imageHeight / 2
    const tileCenterInCanvasX =
      this.canvasWidth / 2 + this.translateX + tileCenterRelativeX * this.scale
    const tileCenterInCanvasY =
      this.canvasHeight / 2 + this.translateY + tileCenterRelativeY * this.scale
    const tileWidthInCanvas = actualTileWidth * this.scale
    const tileHeightInCanvas = actualTileHeight * this.scale
    const scaleX = tileWidthInCanvas / this.canvasWidth
    const scaleY = tileHeightInCanvas / this.canvasHeight
    const translateX = (tileCenterInCanvasX * 2) / this.canvasWidth - 1
    const translateY = -((tileCenterInCanvasY * 2) / this.canvasHeight - 1)

    return new Float32Array([
      scaleX,
      0,
      0,
      0,
      scaleY,
      0,
      translateX,
      translateY,
      1,
    ])
  }

  public zoomIn(animated = false) {
    const centerX = this.canvasWidth / 2
    const centerY = this.canvasHeight / 2
    this.zoomAt(centerX, centerY, 1 + this.config.wheel.step, animated)
  }

  public zoomOut(animated = false) {
    const centerX = this.canvasWidth / 2
    const centerY = this.canvasHeight / 2
    this.zoomAt(centerX, centerY, 1 - this.config.wheel.step, animated)
  }

  public resetView() {
    const fitToScreenScale = this.getFitToScreenScale()
    const targetScale = fitToScreenScale * this.config.initialScale
    this.startAnimation(targetScale, 0, 0)
  }

  public getScale() {
    return this.scale
  }

  public destroy() {
    window.removeEventListener('resize', this.boundResizeCanvas)
    this.canvas.removeEventListener('mousedown', this.boundHandleMouseDown)
    this.canvas.removeEventListener('mousemove', this.boundHandleMouseMove)
    this.canvas.removeEventListener('mouseup', this.boundHandleMouseUp)
    this.canvas.removeEventListener('wheel', this.boundHandleWheel)
    this.canvas.removeEventListener('dblclick', this.boundHandleDoubleClick)
    this.canvas.removeEventListener('touchstart', this.boundHandleTouchStart)
    this.canvas.removeEventListener('touchmove', this.boundHandleTouchMove)
    this.canvas.removeEventListener('touchend', this.boundHandleTouchEnd)

    this.cleanupLODTextures()
    if (this.texture) {
      this.gl.deleteTexture(this.texture)
    }
    if (this.program) {
      this.gl.deleteProgram(this.program)
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
    }

    this.worker?.terminate()
  }

  private updateDebugInfo() {
    const debugTarget = this.onDebugUpdate?.current
    if (!debugTarget) {
      return
    }

    const fitToScreenScale = this.getFitToScreenScale()
    const relativeScale = this.scale / fitToScreenScale
    const userMaxScale = fitToScreenScale * this.config.maxScale
    const originalSizeScale = 1
    const effectiveMaxScale = Math.max(userMaxScale, originalSizeScale)
    const tileMemoryMB = this.tileCache.size * 4
    const totalMemoryMB = tileMemoryMB + this.lodTextures.size * 16
    const memoryBudget = 256

    debugTarget.updateDebugInfo({
      scale: this.scale,
      relativeScale,
      translateX: this.translateX,
      translateY: this.translateY,
      currentLOD: this.currentLOD,
      lodLevels: SIMPLE_LOD_LEVELS.length,
      canvasSize: { width: this.canvasWidth, height: this.canvasHeight },
      imageSize: { width: this.imageWidth, height: this.imageHeight },
      fitToScreenScale,
      userMaxScale,
      effectiveMaxScale,
      originalSizeScale,
      renderCount: performance.now(),
      maxTextureSize: this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE),
      quality: this.currentQuality,
      isLoading: this.isLoadingTexture,
      memory: {
        textures: totalMemoryMB,
        estimated: totalMemoryMB,
        budget: memoryBudget,
        pressure: (totalMemoryMB / memoryBudget) * 100,
        activeLODs: this.lodTextures.size,
        maxConcurrentLODs: 3,
        onDemandStrategy: true,
      },
      tileSystem: {
        cacheSize: this.tileCache.size,
        visibleTiles: this.currentVisibleTiles.size,
        loadingTiles: this.loadingTiles.size,
        pendingRequests: this.pendingTileRequests.length,
        cacheLimit: TILE_CACHE_SIZE,
        maxTilesPerFrame: MAX_TILES_PER_FRAME,
        tileSize: TILE_SIZE,
        cacheKeys: Array.from(this.tileCache.keys()),
        visibleKeys: Array.from(this.currentVisibleTiles),
        loadingKeys: Array.from(this.loadingTiles.keys()),
        pendingKeys: this.pendingTileRequests.map((request) => request.key),
      },
    })
  }

  private notifyZoomChange() {
    if (!this.onZoomChange) {
      return
    }

    const originalScale = this.scale
    const fitToScreenScale = this.getFitToScreenScale()
    const relativeScale = this.scale / fitToScreenScale
    this.onZoomChange(originalScale, relativeScale)
  }

  private notifyLoadingStateChange(
    isLoading: boolean,
    message?: string,
    quality?: 'high' | 'medium' | 'low' | 'unknown',
  ) {
    if (!this.onLoadingStateChange) {
      return
    }

    this.onLoadingStateChange(
      isLoading,
      message,
      quality || this.currentQuality,
    )
  }

  private setupEventListeners() {
    this.canvas.addEventListener('mousedown', this.boundHandleMouseDown)
    this.canvas.addEventListener('mousemove', this.boundHandleMouseMove)
    this.canvas.addEventListener('mouseup', this.boundHandleMouseUp)
    this.canvas.addEventListener('wheel', this.boundHandleWheel)
    this.canvas.addEventListener('dblclick', this.boundHandleDoubleClick)
    this.canvas.addEventListener('touchstart', this.boundHandleTouchStart, {
      passive: false,
    })
    this.canvas.addEventListener('touchmove', this.boundHandleTouchMove, {
      passive: false,
    })
    this.canvas.addEventListener('touchend', this.boundHandleTouchEnd, {
      passive: false,
    })
  }

  private handleMouseDown(event: MouseEvent) {
    if (this.isAnimating) {
      this.isAnimating = false
      this.animationStartLOD = -1
    }
    if (this.config.panning.disabled) {
      return
    }

    this.isDragging = true
    this.lastMouseX = event.clientX
    this.lastMouseY = event.clientY
  }

  private handleMouseMove(event: MouseEvent) {
    if (!this.isDragging || this.config.panning.disabled) {
      return
    }

    const deltaX = event.clientX - this.lastMouseX
    const deltaY = event.clientY - this.lastMouseY

    this.translateX += deltaX
    this.translateY += deltaY
    this.lastMouseX = event.clientX
    this.lastMouseY = event.clientY

    this.constrainImagePosition()
    this.render()
  }

  private handleMouseUp() {
    this.isDragging = false
  }

  private handleWheel(event: WheelEvent) {
    event.preventDefault()
    if (this.config.wheel.wheelDisabled) {
      return
    }

    if (this.isAnimating) {
      this.isAnimating = false
      this.animationStartLOD = -1
    }

    const rect = this.canvas.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top
    const scaleFactor =
      event.deltaY > 0 ? 1 - this.config.wheel.step : 1 + this.config.wheel.step

    this.zoomAt(mouseX, mouseY, scaleFactor)
  }

  private handleDoubleClick(event: MouseEvent) {
    event.preventDefault()
    if (this.config.doubleClick.disabled) {
      return
    }

    const now = Date.now()
    if (now - this.lastDoubleClickTime < 300) {
      return
    }
    this.lastDoubleClickTime = now

    const rect = this.canvas.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top
    this.performDoubleClickAction(mouseX, mouseY)
  }

  private handleTouchStart(event: TouchEvent) {
    event.preventDefault()

    if (this.isAnimating) {
      this.isAnimating = false
      this.animationStartLOD = -1
      return
    }

    if (event.touches.length === 1 && !this.config.panning.disabled) {
      const touch = event.touches[0]
      const now = Date.now()

      if (
        !this.config.doubleClick.disabled &&
        now - this.lastTouchTime < 300 &&
        Math.abs(touch.clientX - this.lastTouchX) < 50 &&
        Math.abs(touch.clientY - this.lastTouchY) < 50
      ) {
        this.handleTouchDoubleTap(touch.clientX, touch.clientY)
        this.lastTouchTime = 0
        return
      }

      this.isDragging = true
      this.lastMouseX = touch.clientX
      this.lastMouseY = touch.clientY
      this.lastTouchTime = now
      this.lastTouchX = touch.clientX
      this.lastTouchY = touch.clientY
    } else if (event.touches.length === 2 && !this.config.pinch.disabled) {
      this.isDragging = false
      const touch1 = event.touches[0]
      const touch2 = event.touches[1]
      this.lastTouchDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2),
      )
    }
  }

  private handleTouchMove(event: TouchEvent) {
    event.preventDefault()

    if (
      event.touches.length === 1 &&
      this.isDragging &&
      !this.config.panning.disabled
    ) {
      const deltaX = event.touches[0].clientX - this.lastMouseX
      const deltaY = event.touches[0].clientY - this.lastMouseY

      this.translateX += deltaX
      this.translateY += deltaY
      this.lastMouseX = event.touches[0].clientX
      this.lastMouseY = event.touches[0].clientY

      this.constrainImagePosition()
      this.render()
    } else if (event.touches.length === 2 && !this.config.pinch.disabled) {
      const touch1 = event.touches[0]
      const touch2 = event.touches[1]
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2),
      )

      if (this.lastTouchDistance > 0) {
        const scaleFactor = distance / this.lastTouchDistance
        const centerX = (touch1.clientX + touch2.clientX) / 2
        const centerY = (touch1.clientY + touch2.clientY) / 2
        const rect = this.canvas.getBoundingClientRect()

        this.zoomAt(centerX - rect.left, centerY - rect.top, scaleFactor)
      }

      this.lastTouchDistance = distance
    }
  }

  private handleTouchEnd() {
    this.isDragging = false
    this.lastTouchDistance = 0
  }

  private handleTouchDoubleTap(clientX: number, clientY: number) {
    if (this.config.doubleClick.disabled) {
      return
    }

    const rect = this.canvas.getBoundingClientRect()
    const touchX = clientX - rect.left
    const touchY = clientY - rect.top
    this.performDoubleClickAction(touchX, touchY)
  }

  private performDoubleClickAction(x: number, y: number) {
    this.isAnimating = false
    this.animationStartLOD = -1

    if (this.config.doubleClick.mode === 'toggle') {
      const fitToScreenScale = this.getFitToScreenScale()
      const absoluteMinScale = fitToScreenScale * this.config.minScale
      const originalSizeScale = 1
      const userMaxScale = fitToScreenScale * this.config.maxScale
      const effectiveMaxScale = Math.max(userMaxScale, originalSizeScale)

      if (this.isOriginalSize) {
        const targetScale = Math.max(
          absoluteMinScale,
          Math.min(effectiveMaxScale, fitToScreenScale),
        )
        const zoomX = (x - this.canvasWidth / 2 - this.translateX) / this.scale
        const zoomY = (y - this.canvasHeight / 2 - this.translateY) / this.scale
        const targetTranslateX = x - this.canvasWidth / 2 - zoomX * targetScale
        const targetTranslateY = y - this.canvasHeight / 2 - zoomY * targetScale

        this.startAnimation(
          targetScale,
          targetTranslateX,
          targetTranslateY,
          this.config.doubleClick.animationTime,
        )
        this.isOriginalSize = false
      } else {
        const targetScale = Math.max(
          absoluteMinScale,
          Math.min(effectiveMaxScale, originalSizeScale),
        )
        const zoomX = (x - this.canvasWidth / 2 - this.translateX) / this.scale
        const zoomY = (y - this.canvasHeight / 2 - this.translateY) / this.scale
        const targetTranslateX = x - this.canvasWidth / 2 - zoomX * targetScale
        const targetTranslateY = y - this.canvasHeight / 2 - zoomY * targetScale

        this.startAnimation(
          targetScale,
          targetTranslateX,
          targetTranslateY,
          this.config.doubleClick.animationTime,
        )
        this.isOriginalSize = true
      }
    } else {
      this.zoomAt(x, y, this.config.doubleClick.step, true)
    }
  }

  public zoomAt(x: number, y: number, scaleFactor: number, animated = false) {
    const newScale = this.scale * scaleFactor
    const fitToScreenScale = this.getFitToScreenScale()
    const absoluteMinScale = fitToScreenScale * this.config.minScale
    const originalSizeScale = 1
    const userMaxScale = fitToScreenScale * this.config.maxScale
    const effectiveMaxScale = Math.max(userMaxScale, originalSizeScale)

    if (newScale < absoluteMinScale || newScale > effectiveMaxScale) {
      return
    }

    if (animated && this.config.smooth) {
      const zoomX = (x - this.canvasWidth / 2 - this.translateX) / this.scale
      const zoomY = (y - this.canvasHeight / 2 - this.translateY) / this.scale
      const targetTranslateX = x - this.canvasWidth / 2 - zoomX * newScale
      const targetTranslateY = y - this.canvasHeight / 2 - zoomY * newScale

      this.startAnimation(newScale, targetTranslateX, targetTranslateY)
      return
    }

    const zoomX = (x - this.canvasWidth / 2 - this.translateX) / this.scale
    const zoomY = (y - this.canvasHeight / 2 - this.translateY) / this.scale

    this.scale = newScale
    this.translateX = x - this.canvasWidth / 2 - zoomX * this.scale
    this.translateY = y - this.canvasHeight / 2 - zoomY * this.scale

    this.constrainImagePosition()
    this.render()
    this.notifyZoomChange()
  }

  async copyOriginalImageToClipboard() {
    try {
      const response = await fetch(this.originalImageSrc)
      const blob = await response.blob()

      if (!navigator.clipboard || !navigator.clipboard.write) {
        console.warn('Clipboard API not supported')
        return
      }

      const clipboardItem = new ClipboardItem({ [blob.type]: blob })
      await navigator.clipboard.write([clipboardItem])
      this.onImageCopied?.()
    } catch (error) {
      console.error('Failed to copy image to clipboard:', error)
    }
  }
}
