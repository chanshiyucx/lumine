'use client'

import dynamic from 'next/dynamic'
import * as React from 'react'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react'
import {
  defaultDoubleClickConfig,
  defaultPanningConfig,
  defaultPinchConfig,
  defaultWheelConfig,
} from './constants'
import type { DebugInfoProps, DebugInfoRef } from './debug-info'
import type {
  ResolvedWebGLImageViewerProps,
  WebGLImageViewerProps,
  WebGLImageViewerRef,
} from './types'
import {
  WebGLImageViewerEngine,
  type WebGLImageViewerEngineOptions,
} from './webgl-image-viewer-engine'

const DebugInfoComponent = dynamic<DebugInfoProps>(
  () => import('./debug-info'),
  {
    ssr: false,
  },
)

const noop = () => {}

export const WebGLImageViewer = forwardRef<
  WebGLImageViewerRef,
  WebGLImageViewerProps &
    Omit<React.HTMLAttributes<HTMLDivElement>, keyof WebGLImageViewerProps>
>(function WebGLImageViewer(
  {
    src,
    alt,
    sourceBlob,
    className = '',
    width,
    height,
    initialScale = 1,
    minScale = 0.1,
    maxScale = 10,
    wheel = defaultWheelConfig,
    pinch = defaultPinchConfig,
    doubleClick = defaultDoubleClickConfig,
    panning = defaultPanningConfig,
    limitToBounds = true,
    centerOnInit = true,
    smooth = true,
    onLoad,
    onZoomChange,
    onError,
    onLoadingStateChange,
    debug = false,
    ...divProps
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewerRef = useRef<WebGLImageViewerEngine | null>(null)
  const debugInfoRef = useRef<DebugInfoRef | null>(null)

  const interactionConfig = useMemo(
    () => ({
      wheel: { ...defaultWheelConfig, ...wheel },
      pinch: { ...defaultPinchConfig, ...pinch },
      doubleClick: { ...defaultDoubleClickConfig, ...doubleClick },
      panning: { ...defaultPanningConfig, ...panning },
    }),
    [doubleClick, panning, pinch, wheel],
  )

  const callbacksRef = useRef<
    Pick<
      ResolvedWebGLImageViewerProps,
      'onError' | 'onLoad' | 'onLoadingStateChange' | 'onZoomChange'
    >
  >({
    onZoomChange: onZoomChange || noop,
    onLoad: onLoad || noop,
    onError: onError || noop,
    onLoadingStateChange: onLoadingStateChange || noop,
  })

  const interactionConfigRef =
    useRef<
      Pick<
        ResolvedWebGLImageViewerProps,
        'doubleClick' | 'panning' | 'pinch' | 'wheel'
      >
    >(interactionConfig)

  useEffect(() => {
    callbacksRef.current = {
      onZoomChange: onZoomChange || noop,
      onLoad: onLoad || noop,
      onError: onError || noop,
      onLoadingStateChange: onLoadingStateChange || noop,
    }
  }, [onError, onLoad, onLoadingStateChange, onZoomChange])

  useEffect(() => {
    interactionConfigRef.current = interactionConfig
    viewerRef.current?.updateInteractionConfig(interactionConfigRef.current)
  }, [interactionConfig])

  useImperativeHandle(ref, () => ({
    zoomIn: (animated?: boolean) => viewerRef.current?.zoomIn(animated),
    zoomOut: (animated?: boolean) => viewerRef.current?.zoomOut(animated),
    resetView: () => viewerRef.current?.resetView(),
    getScale: () => viewerRef.current?.getScale() || 1,
  }))

  useEffect(() => {
    if (!canvasRef.current) {
      return
    }

    const options: WebGLImageViewerEngineOptions = {
      initialScale,
      minScale,
      maxScale,
      wheel: interactionConfigRef.current.wheel,
      pinch: interactionConfigRef.current.pinch,
      doubleClick: interactionConfigRef.current.doubleClick,
      panning: interactionConfigRef.current.panning,
      limitToBounds,
      centerOnInit,
      smooth,
      onZoomChange: (...args) => callbacksRef.current.onZoomChange(...args),
      onLoadingStateChange: (...args) =>
        callbacksRef.current.onLoadingStateChange(...args),
    }

    let webGLImageViewerEngine: WebGLImageViewerEngine | null = null

    try {
      webGLImageViewerEngine = new WebGLImageViewerEngine(
        canvasRef.current,
        options,
        debug ? debugInfoRef : undefined,
      )

      const preknownWidth = width && width > 0 ? width : undefined
      const preknownHeight = height && height > 0 ? height : undefined

      webGLImageViewerEngine
        .loadImage(src, preknownWidth, preknownHeight, sourceBlob)
        .then(() => {
          if (viewerRef.current === webGLImageViewerEngine) {
            callbacksRef.current.onLoad()
          }
        })
        .catch((error) => {
          console.error('Failed to load WebGL image:', error)
          callbacksRef.current.onError(
            error instanceof Error ? error : new Error(String(error)),
          )
        })

      viewerRef.current = webGLImageViewerEngine
    } catch (error) {
      console.error('Failed to initialize WebGL Image Viewer:', error)
      callbacksRef.current.onError(
        error instanceof Error ? error : new Error(String(error)),
      )
    }

    return () => {
      webGLImageViewerEngine?.destroy()
      viewerRef.current = null
    }
  }, [
    centerOnInit,
    debug,
    height,
    initialScale,
    limitToBounds,
    maxScale,
    minScale,
    smooth,
    sourceBlob,
    src,
    width,
  ])

  return (
    <div
      {...divProps}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        ...divProps.style,
      }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={alt}
        className={className}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          touchAction: 'none',
          border: 'none',
          outline: 'none',
          margin: 0,
          padding: 0,
        }}
      />
      {debug ? <DebugInfoComponent ref={debugInfoRef} /> : null}
    </div>
  )
})

WebGLImageViewer.displayName = 'WebGLImageViewer'
