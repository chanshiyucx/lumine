'use client'

import { preload } from 'react-dom'

interface ImagePreloadsProps {
  urls: readonly string[]
}

// Called from a Server Component, preload() becomes a hint in the RSC payload
// that also fires on route prefetches. Rendering it here limits the hint to SSR
// and actual navigations.
export function ImagePreloads({ urls }: ImagePreloadsProps) {
  for (const url of urls) {
    preload(url, { as: 'image', fetchPriority: 'high' })
  }

  return null
}
