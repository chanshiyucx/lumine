'use client'

import { useEffect, useState } from 'react'
import { isProd } from '@/lib/env'

type ImageViewerRenderer = 'dom' | 'webgl'

const DEFAULT_RENDERER: ImageViewerRenderer = 'dom'

interface ImageViewerRendererState {
  debug: boolean
  renderer: ImageViewerRenderer
}

function getRendererStateFromLocation(): ImageViewerRendererState {
  if (isProd) {
    return {
      debug: false,
      renderer: DEFAULT_RENDERER,
    }
  }

  const searchParams = new URLSearchParams(window.location.search)
  const renderer =
    searchParams.get('viewer') === 'webgl' ? 'webgl' : DEFAULT_RENDERER

  return {
    debug: renderer === 'webgl' && searchParams.get('debug') === '1',
    renderer,
  }
}

export function useImageViewerRenderer() {
  const [state, setState] = useState<ImageViewerRendererState | null>(null)

  useEffect(() => {
    const syncFromLocation = () => {
      setState(getRendererStateFromLocation())
    }

    syncFromLocation()
    window.addEventListener('popstate', syncFromLocation)

    return () => {
      window.removeEventListener('popstate', syncFromLocation)
    }
  }, [])

  return state
}
