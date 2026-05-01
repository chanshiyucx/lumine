export interface WheelConfig {
  step: number
  wheelDisabled?: boolean
}

export interface PinchConfig {
  step: number
  disabled?: boolean
}

export interface DoubleClickConfig {
  step: number
  disabled?: boolean
  mode: 'toggle' | 'zoom'
  animationTime: number
}

export interface PanningConfig {
  disabled?: boolean
}

export interface WebGLImageViewerProps {
  src: string
  sourceBlob?: Blob
  className?: string
  width?: number
  height?: number
  initialScale?: number
  minScale?: number
  maxScale?: number
  wheel?: WheelConfig
  pinch?: PinchConfig
  doubleClick?: DoubleClickConfig
  panning?: PanningConfig
  limitToBounds?: boolean
  centerOnInit?: boolean
  smooth?: boolean
  onZoomChange?: (originalScale: number, relativeScale: number) => void
  onError?: (error: Error) => void
  onLoadingStateChange?: (
    isLoading: boolean,
    message?: string,
    quality?: 'high' | 'medium' | 'low' | 'unknown',
  ) => void
  debug?: boolean
}

export type ResolvedWebGLImageViewerProps = Required<
  Omit<WebGLImageViewerProps, 'sourceBlob'>
> & {
  sourceBlob?: Blob
}

export interface WebGLImageViewerRef {
  zoomIn: (animated?: boolean) => void
  zoomOut: (animated?: boolean) => void
  resetView: () => void
  getScale: () => number
}

export interface DebugInfo {
  scale: number
  relativeScale: number
  translateX: number
  translateY: number
  currentLOD: number
  lodLevels: number
  canvasSize: { width: number; height: number }
  imageSize: { width: number; height: number }
  fitToScreenScale: number
  userMaxScale: number
  effectiveMaxScale: number
  originalSizeScale: number
  renderCount: number
  maxTextureSize: number
  quality: 'high' | 'medium' | 'low' | 'unknown'
  isLoading: boolean
  memory: {
    textures: number
    estimated: number
    budget: number
    pressure: number
    activeLODs: number
    maxConcurrentLODs: number
    onDemandStrategy?: boolean
  }
  tileSystem?: {
    cacheSize: number
    visibleTiles: number
    loadingTiles: number
    pendingRequests: number
    cacheLimit: number
    maxTilesPerFrame: number
    tileSize: number
    cacheKeys: string[]
    visibleKeys: string[]
    loadingKeys: string[]
    pendingKeys: string[]
  }
}
