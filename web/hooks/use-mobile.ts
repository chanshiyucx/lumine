'use client'

import { useMediaQuery } from './use-media-query'

const MOBILE_MEDIA_QUERY = '(max-width: 1023.98px)'

export function useMobile() {
  return useMediaQuery(MOBILE_MEDIA_QUERY)
}
