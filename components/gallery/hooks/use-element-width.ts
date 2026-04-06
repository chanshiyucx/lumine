'use client'

import { useLayoutEffect, useState, type RefObject } from 'react'

export function useElementWidth<T extends Element>(ref: RefObject<T | null>) {
  const [width, setWidth] = useState(() => {
    if (typeof window === 'undefined') {
      return 0
    }

    return Math.floor(window.innerWidth)
  })

  useLayoutEffect(() => {
    const node = ref.current

    if (!node) {
      return
    }

    const syncWidth = () => {
      const nextWidth = Math.floor(node.getBoundingClientRect().width)

      setWidth((currentWidth) => {
        if (currentWidth === nextWidth) {
          return currentWidth
        }

        return nextWidth
      })
    }

    syncWidth()

    const observer = new ResizeObserver((entries) => {
      const nextWidth = Math.floor(entries[0]?.contentRect.width ?? 0)

      setWidth((currentWidth) => {
        if (currentWidth === nextWidth) {
          return currentWidth
        }

        return nextWidth
      })
    })

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [ref])

  return width
}
