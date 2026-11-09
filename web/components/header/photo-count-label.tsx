'use client'

import { useSelectedLayoutSegment } from 'next/navigation'
import { useSyncExternalStore } from 'react'
import { PRIVATE_PATH } from '@/lib/route-paths'
import { isHeaderNavItemActive } from './lib/header-nav-state'
import { PHOTO_COUNT_CLASS_NAME } from './lib/header-styles'
import {
  getPublishedPhotoCount,
  getPublishedPhotoCountOnServer,
  subscribePublishedPhotoCount,
} from './lib/photo-count-store'

interface PhotoCountLabelProps {
  publicCount: number
}

export function PhotoCountLabel({ publicCount }: PhotoCountLabelProps) {
  const segment = useSelectedLayoutSegment()
  const publishedCount = useSyncExternalStore(
    subscribePublishedPhotoCount,
    getPublishedPhotoCount,
    getPublishedPhotoCountOnServer,
  )
  // Private routes show only their own count: none while locked, never the public total.
  const count = isHeaderNavItemActive(segment, PRIVATE_PATH)
    ? publishedCount
    : publicCount
  const title = count === null ? undefined : `${count} photos`

  return (
    <span className={PHOTO_COUNT_CLASS_NAME} aria-label={title} title={title}>
      {count}
    </span>
  )
}
