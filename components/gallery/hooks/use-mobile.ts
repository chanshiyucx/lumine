'use client'

import { useSyncExternalStore } from 'react'

const MOBILE_MEDIA_QUERY = '(max-width: 1023.98px)'

function subscribe(callback: () => void) {
  const mq = window.matchMedia(MOBILE_MEDIA_QUERY)
  mq.addEventListener('change', callback)
  return () => mq.removeEventListener('change', callback)
}

function getSnapshot() {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches
}

function getServerSnapshot() {
  return false
}

export function useMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
