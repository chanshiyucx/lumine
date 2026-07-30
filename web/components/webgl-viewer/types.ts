import type {
  DoubleClickConfig,
  ImageViewerProps,
  ImageViewerRef,
  PanningConfig,
  PinchConfig,
  WheelConfig,
} from '../image-viewer/types'

export interface WebGLImageViewerProps extends ImageViewerProps {
  sourceBlob?: Blob
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

export type WebGLImageViewerRef = ImageViewerRef

export type { DoubleClickConfig, PanningConfig, PinchConfig, WheelConfig }

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
    maxConcurrentRequests: number
    tileSize: number
    cacheKeys: string[]
    visibleKeys: string[]
    loadingKeys: string[]
    pendingKeys: string[]
  }
}
