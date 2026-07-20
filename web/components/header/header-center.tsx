'use client'

import { useSyncExternalStore } from 'react'
import {
  getGalleryHeaderDetail,
  subscribeGalleryHeaderDetail,
} from './gallery-header-events'

export function HeaderCenter() {
  const detail = useSyncExternalStore(
    subscribeGalleryHeaderDetail,
    getGalleryHeaderDetail,
    getGalleryHeaderDetail,
  )

  const visible = detail.showDateRange && detail.dateRange

  return (
    <div
      aria-hidden={!visible}
      className={[
        'absolute left-1/2 hidden -translate-x-1/2 flex-col items-center transition-[opacity,filter,transform] duration-300 ease-out lg:flex',
        visible
          ? 'blur-0 translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-5 opacity-0 blur-sm',
      ].join(' ')}
    >
      <span className="text-xs font-semibold text-white lg:text-sm">
        {detail.dateRange}
      </span>
      {detail.location && (
        <span className="text-[10px] text-white/60 lg:text-xs">
          {detail.location}
        </span>
      )}
    </div>
  )
}
