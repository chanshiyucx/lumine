import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type RefObject,
} from 'react'
import type { Photo } from '@/lib/photo'
import {
  getPhotoPath,
  getPhotoSlugFromPathname,
  isPhotoPathname,
} from '@/lib/route-paths'
import {
  createClosedViewerState,
  createDirectViewerState,
  reduceViewerState,
  type ViewerAction,
} from '../lib/viewer-state'
import { resolveViewerTrigger } from '../lib/viewer-trigger'

const VIEWER_HISTORY_KEY = '__lumineViewer'

interface ViewerHistoryMarker {
  baseUrl: string
  sessionId: string
}

interface UseViewerControllerOptions {
  galleryRef: RefObject<HTMLElement | null>
  initialPhotoSlug?: string
  photos: Photo[]
}

function getPhotoIndexFromPathname(
  pathname: string,
  slugToIndex: Map<string, number>,
) {
  const photoSlug = getPhotoSlugFromPathname(pathname)

  if (photoSlug === null) {
    return null
  }

  return slugToIndex.get(photoSlug) ?? null
}

function getHistoryMarker(): ViewerHistoryMarker | null {
  const state = window.history.state as
    Record<string, unknown> | null | undefined
  const marker = state?.[VIEWER_HISTORY_KEY]

  if (
    !marker ||
    typeof marker !== 'object' ||
    !('baseUrl' in marker) ||
    !('sessionId' in marker) ||
    typeof marker.baseUrl !== 'string' ||
    typeof marker.sessionId !== 'string'
  ) {
    return null
  }

  return {
    baseUrl: marker.baseUrl,
    sessionId: marker.sessionId,
  }
}

function withHistoryMarker(marker: ViewerHistoryMarker) {
  return {
    ...(window.history.state ?? {}),
    [VIEWER_HISTORY_KEY]: marker,
  }
}

function withoutHistoryMarker() {
  const state = {
    ...(window.history.state ?? {}),
  } as Record<string, unknown>

  delete state[VIEWER_HISTORY_KEY]

  return state
}

function createSessionId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function useViewerController({
  galleryRef,
  photos,
  initialPhotoSlug,
}: UseViewerControllerOptions) {
  const slugToIndex = new Map(photos.map((photo, index) => [photo.slug, index]))
  const initialIndex = initialPhotoSlug
    ? (slugToIndex.get(initialPhotoSlug) ?? null)
    : null
  const [state, setState] = useState(() =>
    initialIndex === null
      ? createClosedViewerState()
      : createDirectViewerState(initialIndex),
  )
  const stateRef = useRef(state)
  const sessionIdRef = useRef<string | null>(null)
  const baseUrlRef = useRef('/')
  const restoreFocusElementRef = useRef<HTMLElement | null>(null)
  const isPresentRef = useRef(false)

  const applyAction = (action: ViewerAction) => {
    const nextState = reduceViewerState(stateRef.current, action)
    stateRef.current = nextState
    setState(nextState)
  }

  const getSessionId = () => {
    const currentSessionId = sessionIdRef.current
    if (currentSessionId) {
      return currentSessionId
    }

    const sessionId = createSessionId()
    sessionIdRef.current = sessionId
    return sessionId
  }

  const getPhotoUrl = (photo: Photo) => {
    return `${getPhotoPath(photo.slug)}${window.location.search}${window.location.hash}`
  }

  const open = (index: number, explicitTrigger?: HTMLElement | null) => {
    const photo = photos[index]
    if (!photo || stateRef.current.phase !== 'closed') {
      return
    }

    const triggerElement = resolveViewerTrigger(photo.id, explicitTrigger)
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (!isPhotoPathname(window.location.pathname)) {
      baseUrlRef.current = currentUrl
    }

    const marker = {
      baseUrl: baseUrlRef.current,
      sessionId: getSessionId(),
    }

    restoreFocusElementRef.current = triggerElement
    applyAction({
      type: 'open',
      index,
      mode: triggerElement ? 'shared' : 'fade',
      triggerElement,
    })
    window.history.pushState(withHistoryMarker(marker), '', getPhotoUrl(photo))
  }

  const select = (index: number) => {
    const photo = photos[index]
    const current = stateRef.current
    if (!photo || current.phase !== 'open' || current.activeIndex === index) {
      return
    }

    applyAction({ type: 'select', index })

    const marker = getHistoryMarker() ?? {
      baseUrl: baseUrlRef.current,
      sessionId: getSessionId(),
    }
    window.history.replaceState(
      withHistoryMarker(marker),
      '',
      getPhotoUrl(photo),
    )
  }

  const beginClose = () => {
    const current = stateRef.current
    if (current.phase === 'closed' || current.phase === 'exiting') {
      return false
    }

    const photo = photos[current.activeIndex]
    if (!photo) {
      return false
    }

    const triggerElement = current.isZoomed
      ? null
      : resolveViewerTrigger(photo.id, current.triggerElement)
    restoreFocusElementRef.current = triggerElement
    applyAction({
      type: 'close',
      mode: triggerElement ? 'shared' : 'fade',
      triggerElement,
    })

    if (!isPresentRef.current) {
      applyAction({
        type: 'exit-complete',
        operationId: stateRef.current.operationId,
      })
    }

    return true
  }

  const close = () => {
    if (!beginClose()) {
      return
    }

    const marker = getHistoryMarker()
    if (marker?.sessionId === sessionIdRef.current) {
      window.history.back()
      return
    }

    window.history.replaceState(withoutHistoryMarker(), '', baseUrlRef.current)
  }

  const setZoomed = (isZoomed: boolean) => {
    applyAction({ type: 'set-zoomed', isZoomed })
  }

  const completeEntry = (operationId: number) => {
    applyAction({ type: 'entry-complete', operationId })
  }

  const completeExit = (operationId: number) => {
    applyAction({ type: 'exit-complete', operationId })
  }

  const getRestoreFocusElement = () => {
    const preferred = restoreFocusElementRef.current
    if (preferred?.isConnected) {
      return preferred
    }

    return galleryRef.current
  }

  const setPresence = (present: boolean) => {
    isPresentRef.current = present
  }

  const syncFromLocation = useEffectEvent(() => {
    const index = getPhotoIndexFromPathname(
      window.location.pathname,
      slugToIndex,
    )

    if (index !== null) {
      const current = stateRef.current
      if (current.phase === 'open' && current.activeIndex === index) {
        return
      }

      const photo = photos[index]
      const triggerElement = resolveViewerTrigger(
        photo.id,
        current.phase === 'closed' ? null : current.triggerElement,
      )
      restoreFocusElementRef.current = triggerElement
      applyAction({
        type: 'open',
        index,
        mode: triggerElement ? 'shared' : 'fade',
        triggerElement,
      })
      return
    }

    beginClose()
  })

  useEffect(() => {
    baseUrlRef.current = `/${window.location.search}${window.location.hash}`

    window.addEventListener('popstate', syncFromLocation)

    return () => {
      window.removeEventListener('popstate', syncFromLocation)
    }
  }, [])

  return {
    close,
    completeEntry,
    completeExit,
    getRestoreFocusElement,
    open,
    select,
    setPresence,
    setZoomed,
    state,
  }
}
