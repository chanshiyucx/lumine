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
import { WebGLImageViewerEngine } from './webgl-image-viewer-engine'

const DebugInfoComponent = dynamic<DebugInfoProps>(
  () => import('./debug-info'),
  {
    ssr: false,
  },
)

export const WebGLImageViewer = forwardRef<
  WebGLImageViewerRef,
  WebGLImageViewerProps &
    Omit<React.HTMLAttributes<HTMLDivElement>, 'className'>
>(function WebGLImageViewer(
  {
    src,
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

  const config: ResolvedWebGLImageViewerProps = useMemo(
    () => ({
      src,
      sourceBlob,
      className,
      width: width || 0,
      height: height || 0,
      initialScale,
      minScale,
      maxScale,
      wheel: { ...defaultWheelConfig, ...wheel },
      pinch: { ...defaultPinchConfig, ...pinch },
      doubleClick: { ...defaultDoubleClickConfig, ...doubleClick },
      panning: { ...defaultPanningConfig, ...panning },
      limitToBounds,
      centerOnInit,
      smooth,
      onZoomChange: onZoomChange || (() => {}),
      onError: onError || (() => {}),
      onLoadingStateChange: onLoadingStateChange || (() => {}),
      debug,
    }),
    [
      src,
      sourceBlob,
      className,
      width,
      height,
      initialScale,
      minScale,
      maxScale,
      wheel,
      pinch,
      doubleClick,
      panning,
      limitToBounds,
      centerOnInit,
      smooth,
      onZoomChange,
      onError,
      onLoadingStateChange,
      debug,
    ],
  )

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

    let webGLImageViewerEngine: WebGLImageViewerEngine | null = null

    try {
      webGLImageViewerEngine = new WebGLImageViewerEngine(
        canvasRef.current,
        config,
        debug ? debugInfoRef : undefined,
      )

      const preknownWidth = config.width > 0 ? config.width : undefined
      const preknownHeight = config.height > 0 ? config.height : undefined

      webGLImageViewerEngine
        .loadImage(src, preknownWidth, preknownHeight, config.sourceBlob)
        .catch((error) => {
          console.error('Failed to load WebGL image:', error)
          config.onError(
            error instanceof Error ? error : new Error(String(error)),
          )
        })

      viewerRef.current = webGLImageViewerEngine
    } catch (error) {
      console.error('Failed to initialize WebGL Image Viewer:', error)
      config.onError(error instanceof Error ? error : new Error(String(error)))
    }

    return () => {
      webGLImageViewerEngine?.destroy()
      viewerRef.current = null
    }
  }, [src, config, debug])

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
