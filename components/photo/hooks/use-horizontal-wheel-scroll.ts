'use client'

import { useEffect, type RefObject } from 'react'

export function useHorizontalWheelScroll<T extends HTMLElement>(
  ref: RefObject<T | null>,
) {
  useEffect(() => {
    const node = ref.current

    if (!node) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        return
      }

      event.preventDefault()
      node.scrollLeft += event.deltaY
    }

    node.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      node.removeEventListener('wheel', handleWheel)
    }
  }, [ref])
}
