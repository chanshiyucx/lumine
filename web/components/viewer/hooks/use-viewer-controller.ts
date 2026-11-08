import { useRouter } from 'next/navigation'
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type RefObject,
} from 'react'
import type { Photo } from '@/lib/photo'
import {
  getGalleryPath,
  getPhotoPath,
  getPhotoSlugFromPathname,
  isPhotoPathname,
  type PhotoScope,
} from '@/lib/route-paths'
import { getHistoryMarker, withHistoryMarker } from '../lib/viewer-history'
import {
  createClosedViewerState,
  createDirectViewerState,
  reduceViewerState,
  type ViewerAction,
} from '../lib/viewer-state'
import { resolveViewerTrigger } from '../lib/viewer-trigger'

// The route change after closing replaces this gallery, so the next one has to
// take over the focus the viewer would have restored.
let shouldFocusNextGallery = false

interface UseViewerControllerOptions {
  galleryRef: RefObject<HTMLElement | null>
  initialPhotoSlug?: string
  photos: Photo[]
  scope: PhotoScope
}

function getPhotoIndexFromPathname(
  pathname: string,
  scope: PhotoScope,
  slugToIndex: Map<string, number>,
) {
  const photoSlug = getPhotoSlugFromPathname(pathname, scope)
  return photoSlug === null ? null : (slugToIndex.get(photoSlug) ?? null)
}

function createSessionId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function useViewerController({
  galleryRef,
  initialPhotoSlug,
  photos,
  scope,
}: UseViewerControllerOptions) {
  const router = useRouter()
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
  const exitUrlRef = useRef<string | null>(null)
  const restoreFocusElementRef = useRef<HTMLElement | null>(null)
  const isPresentRef = useRef(false)

  const applyAction = (action: ViewerAction) => {
    const nextState = reduceViewerState(stateRef.current, action)
    stateRef.current = nextState
    setState(nextState)
  }

  const getSessionId = () => {
    sessionIdRef.current ??= createSessionId()
    return sessionIdRef.current
  }

  const getPhotoUrl = (photo: Photo) =>
    `${getPhotoPath(photo.slug, scope)}${window.location.search}${window.location.hash}`

  const showPhoto = (index: number, triggerElement: HTMLElement | null) => {
    restoreFocusElementRef.current = triggerElement
    applyAction({
      type: 'open',
      index,
      mode: triggerElement ? 'shared' : 'fade',
      triggerElement,
    })
  }

  const open = (index: number, explicitTrigger?: HTMLElement | null) => {
    const photo = photos[index]
    if (!photo || stateRef.current.phase !== 'closed') {
      return
    }

    const { pathname, search, hash } = window.location
    if (!isPhotoPathname(pathname, scope)) {
      baseUrlRef.current = `${pathname}${search}${hash}`
    }

    const marker = {
      baseUrl: baseUrlRef.current,
      sessionId: getSessionId(),
    }

    showPhoto(index, resolveViewerTrigger(photo.id, explicitTrigger))
    window.history.pushState(withHistoryMarker(marker), '', getPhotoUrl(photo))
  }

  const select = (index: number) => {
    const photo = photos[index]
    const current = stateRef.current
    if (!photo || current.phase !== 'open' || current.activeIndex === index) {
      return
    }

    applyAction({ type: 'select', index })

    // The marker stands for a gallery entry, so only open() may create one.
    window.history.replaceState(window.history.state, '', getPhotoUrl(photo))
  }

  const completeExit = (operationId: number) => {
    applyAction({ type: 'exit-complete', operationId })

    const exitUrl = exitUrlRef.current
    if (exitUrl !== null && stateRef.current.phase === 'closed') {
      exitUrlRef.current = null
      shouldFocusNextGallery = true
      router.replace(exitUrl)
    }
  }

  const beginClose = (exitUrl: string | null = null) => {
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
    exitUrlRef.current = exitUrl
    applyAction({
      type: 'close',
      mode: triggerElement ? 'shared' : 'fade',
      triggerElement,
    })

    if (!isPresentRef.current) {
      completeExit(stateRef.current.operationId)
    }

    return true
  }

  const close = () => {
    const hasGalleryEntry =
      getHistoryMarker()?.sessionId === sessionIdRef.current

    // Without a gallery entry to return to, the page behind the viewer is still
    // the photo route, and only the router can move this history entry off it.
    const exitUrl = hasGalleryEntry ? null : baseUrlRef.current

    if (beginClose(exitUrl) && hasGalleryEntry) {
      window.history.back()
    }
  }

  const setZoomed = (isZoomed: boolean) => {
    applyAction({ type: 'set-zoomed', isZoomed })
  }

  const completeEntry = (operationId: number) => {
    applyAction({ type: 'entry-complete', operationId })
  }

  const getRestoreFocusElement = () => {
    const preferred = restoreFocusElementRef.current
    return preferred?.isConnected ? preferred : galleryRef.current
  }

  const setPresence = (present: boolean) => {
    isPresentRef.current = present
  }

  const syncFromLocation = useEffectEvent(() => {
    const index = getPhotoIndexFromPathname(
      window.location.pathname,
      scope,
      slugToIndex,
    )
    if (index === null) {
      beginClose()
      return
    }

    const current = stateRef.current
    if (current.phase === 'open' && current.activeIndex === index) {
      return
    }

    const photo = photos[index]!
    showPhoto(
      index,
      resolveViewerTrigger(
        photo.id,
        current.phase === 'closed' ? null : current.triggerElement,
      ),
    )
  })

  useEffect(() => {
    if (shouldFocusNextGallery) {
      shouldFocusNextGallery = false
      galleryRef.current?.focus({ preventScroll: true })
    }
  }, [galleryRef])

  useEffect(() => {
    const { pathname, search, hash } = window.location
    baseUrlRef.current = `${isPhotoPathname(pathname, scope) ? getGalleryPath(scope) : pathname}${search}${hash}`

    window.addEventListener('popstate', syncFromLocation)

    return () => window.removeEventListener('popstate', syncFromLocation)
  }, [scope])

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
