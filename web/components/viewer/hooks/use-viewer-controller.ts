import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { getPhotoPath, type Photo } from '@/lib/photo'
import { decodePathSegment } from '@/lib/url-segments'
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
  initialPhotoSlug?: string
  photos: Photo[]
}

function getPhotoIndexFromPathname(
  pathname: string,
  slugToIndex: Map<string, number>,
) {
  const match = /^\/photos\/([^/]+)$/.exec(pathname)

  if (!match) {
    return null
  }

  return slugToIndex.get(decodePathSegment(match[1])) ?? null
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

  return marker as unknown as ViewerHistoryMarker
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
  photos,
  initialPhotoSlug,
}: UseViewerControllerOptions) {
  const slugToIndex = useMemo(
    () => new Map(photos.map((photo, index) => [photo.slug, index])),
    [photos],
  )
  const initialIndex = initialPhotoSlug
    ? (slugToIndex.get(initialPhotoSlug) ?? null)
    : null
  const [state, dispatch] = useReducer(
    reduceViewerState,
    initialIndex === null
      ? createClosedViewerState()
      : createDirectViewerState(initialIndex),
  )
  const stateRef = useRef(state)
  const sessionIdRef = useRef<string | null>(null)
  const baseUrlRef = useRef('/')
  const restoreFocusElementRef = useRef<HTMLElement | null>(null)

  stateRef.current = state

  const applyAction = useCallback((action: ViewerAction) => {
    stateRef.current = reduceViewerState(stateRef.current, action)
    dispatch(action)
  }, [])

  const getSessionId = useCallback(() => {
    sessionIdRef.current ??= createSessionId()
    return sessionIdRef.current
  }, [])

  const getPhotoUrl = useCallback((photo: Photo) => {
    return `${getPhotoPath(photo.slug)}${window.location.search}${window.location.hash}`
  }, [])

  const open = useCallback(
    (index: number, explicitTrigger?: HTMLElement | null) => {
      const photo = photos[index]
      if (!photo || stateRef.current.phase !== 'closed') {
        return
      }

      const triggerElement = resolveViewerTrigger(photo.id, explicitTrigger)
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (!window.location.pathname.startsWith('/photos/')) {
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
      window.history.pushState(
        withHistoryMarker(marker),
        '',
        getPhotoUrl(photo),
      )
    },
    [applyAction, getPhotoUrl, getSessionId, photos],
  )

  const select = useCallback(
    (index: number) => {
      const photo = photos[index]
      if (!photo || stateRef.current.phase !== 'open') {
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
    },
    [applyAction, getPhotoUrl, getSessionId, photos],
  )

  const beginClose = useCallback(() => {
    const current = stateRef.current
    const photo =
      current.activeIndex === null ? null : photos[current.activeIndex]
    if (!photo || current.phase === 'closed' || current.phase === 'exiting') {
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

    return true
  }, [applyAction, photos])

  const close = useCallback(() => {
    if (!beginClose()) {
      return
    }

    const marker = getHistoryMarker()
    if (marker?.sessionId === sessionIdRef.current) {
      window.history.back()
      return
    }

    window.history.replaceState(withoutHistoryMarker(), '', baseUrlRef.current)
  }, [beginClose])

  const setZoomed = useCallback(
    (isZoomed: boolean) => {
      applyAction({ type: 'set-zoomed', isZoomed })
    },
    [applyAction],
  )

  const completeEntry = useCallback(
    (operationId: number) => {
      applyAction({ type: 'entry-complete', operationId })
    },
    [applyAction],
  )

  const completeExit = useCallback(
    (operationId: number) => {
      applyAction({ type: 'exit-complete', operationId })
    },
    [applyAction],
  )

  const getRestoreFocusElement = useCallback(() => {
    const preferred = restoreFocusElementRef.current
    if (preferred?.isConnected) {
      return preferred
    }

    return document.querySelector<HTMLElement>('[data-gallery-root]')
  }, [])

  useEffect(() => {
    baseUrlRef.current = `/${window.location.search}${window.location.hash}`

    const syncFromLocation = () => {
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
        const triggerElement = photo
          ? resolveViewerTrigger(photo.id, current.triggerElement)
          : null
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
    }

    window.addEventListener('popstate', syncFromLocation)

    return () => {
      window.removeEventListener('popstate', syncFromLocation)
    }
  }, [applyAction, beginClose, photos, slugToIndex])

  return {
    close,
    completeEntry,
    completeExit,
    getRestoreFocusElement,
    open,
    select,
    setZoomed,
    state,
  }
}
