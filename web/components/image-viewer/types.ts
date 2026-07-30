export interface WheelConfig {
  /** Fractional scale change per wheel event, e.g. 0.1 means ×0.9 or ×1.1. */
  step: number
  wheelDisabled?: boolean
}

export interface PinchConfig {
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

export interface ImageViewerProps {
  src: string
  alt: string
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
  onLoad?: () => void
  /** Reports source-pixel scale first and fit-relative scale second. */
  onZoomChange?: (pixelScale: number, relativeScale: number) => void
  onError?: (error: Error) => void
}

export interface ImageViewerRef {
  zoomIn: (animated?: boolean) => void
  zoomOut: (animated?: boolean) => void
  resetView: () => void
  getScale: () => number
}
