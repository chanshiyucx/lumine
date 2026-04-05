'use client'

import { useEffect, useState, type RefObject } from 'react'

export function useElementWidth<T extends Element>(ref: RefObject<T | null>) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const node = ref.current

    if (!node) {
      return
    }

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
