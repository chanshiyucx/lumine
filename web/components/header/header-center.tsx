'use client'

import { useSyncExternalStore } from 'react'
import { cn } from '@/lib/style'
import {
  getGalleryHeaderDetail,
  subscribeGalleryHeaderDetail,
} from './lib/gallery-header-store'

export function HeaderCenter() {
  const detail = useSyncExternalStore(
    subscribeGalleryHeaderDetail,
    getGalleryHeaderDetail,
    getGalleryHeaderDetail,
  )

  const isVisible = detail.showDate && Boolean(detail.date)

  return (
    <div
      aria-hidden={!isVisible}
      className={cn(
        'absolute left-1/2 flex -translate-x-1/2 flex-col items-center transition-[opacity,filter,transform] duration-300 ease-out motion-reduce:transition-none',
        isVisible
          ? 'blur-0 translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-5 opacity-0 blur-sm',
      )}
    >
      <span className="text-text text-xs font-semibold lg:text-sm">
        {detail.date}
      </span>
      {detail.location && (
        <span className="text-text/80 text-[10px] lg:text-xs">
          {detail.location}
        </span>
      )}
    </div>
  )
}
