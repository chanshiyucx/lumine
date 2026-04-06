'use client'

import { useLayoutEffect, useState } from 'react'

interface ViewportSize {
  width: number
  height: number
}

function getViewportSize(): ViewportSize {
  if (typeof window === 'undefined') {
    return {
      width: 0,
      height: 0,
    }
  }

  return {
    width: Math.floor(window.innerWidth),
    height: Math.floor(window.innerHeight),
  }
}

export function useViewportSize() {
  const [viewportSize, setViewportSize] =
    useState<ViewportSize>(getViewportSize)

  useLayoutEffect(() => {
    let frame = 0

    const syncViewportSize = () => {
      frame = 0

      setViewportSize((currentSize) => {
        const nextSize = getViewportSize()

        if (
          currentSize.width === nextSize.width &&
          currentSize.height === nextSize.height
        ) {
          return currentSize
        }

        return nextSize
      })
    }

    const handleResize = () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame)
      }

      frame = window.requestAnimationFrame(syncViewportSize)
    }

    syncViewportSize()
    window.addEventListener('resize', handleResize)

    return () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame)
      }

      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return viewportSize
}
