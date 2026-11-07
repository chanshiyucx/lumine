'use client'

import { useCallback, useEffect, useRef } from 'react'

/** A single pending timeout: scheduling replaces it, unmounting cancels it. */
export function useTimeout() {
  const timeoutRef = useRef<number>(undefined)

  const cancel = useCallback(() => window.clearTimeout(timeoutRef.current), [])

  const schedule = useCallback(
    (callback: () => void, delayMs: number) => {
      cancel()
      timeoutRef.current = window.setTimeout(callback, delayMs)
    },
    [cancel],
  )

  useEffect(() => cancel, [cancel])

  return { schedule, cancel }
}
