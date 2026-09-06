import { useCallback, useEffect, useRef } from 'react'
import { publishGalleryHeaderDetail } from '@/components/header/lib/gallery-header-store'
import type { Photo } from '@/lib/photo'
import {
  getGalleryHeaderState,
  type GalleryHeaderState,
} from '../lib/gallery-header-state'

const HEADER_SCROLL_THRESHOLD = 500

export function useGalleryHeader(
  scrollElement: HTMLElement | null,
  fixedHeaderDetail?: Required<GalleryHeaderState>,
) {
  const visibleHeaderRef = useRef<GalleryHeaderState>({})
  const hasFixedHeader = fixedHeaderDetail !== undefined
  const publishHeader = useCallback(() => {
    const { date, location } = fixedHeaderDetail ?? visibleHeaderRef.current

    publishGalleryHeaderDetail({
      date,
      location,
      showDate:
        !!date &&
        (hasFixedHeader ||
          (scrollElement?.scrollTop ?? 0) > HEADER_SCROLL_THRESHOLD),
    })
  }, [fixedHeaderDetail, hasFixedHeader, scrollElement])

  useEffect(() => {
    publishHeader()
    if (hasFixedHeader || !scrollElement) {
      return
    }

    scrollElement.addEventListener('scroll', publishHeader, { passive: true })
    return () => scrollElement.removeEventListener('scroll', publishHeader)
  }, [hasFixedHeader, publishHeader, scrollElement])

  useEffect(() => {
    return () => publishGalleryHeaderDetail({ showDate: false })
  }, [])

  return useCallback(
    (photo: Photo | undefined) => {
      visibleHeaderRef.current = getGalleryHeaderState(photo)
      publishHeader()
    },
    [publishHeader],
  )
}
