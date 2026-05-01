'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { publishGalleryHeaderDetail } from '@/components/header/gallery-header-events'
import { Viewer } from '@/components/viewer'
import { useViewerHistory } from '@/components/viewer/hooks/use-photo-viewer-history'
import type { Photo } from '@/lib/photos'
import type { MasonryGridProps } from './masonry-grid'

const MasonryGrid = dynamic<MasonryGridProps>(
  () => import('./masonry-grid').then((mod) => mod.MasonryGrid),
  {
    ssr: false,
  },
)

interface MasonryProps {
  photos: Photo[]
  initialPhotoSlug?: string
  basePath?: string
}

interface DateParts {
  year: number
  month: number
  day: number
  key: number
}

interface GalleryHeaderState {
  dateRange?: string
  location?: string
}

interface DatedPhoto {
  date: DateParts
  photo: Photo
}

const HEADER_SCROLL_THRESHOLD = 500
const ENGLISH_DATE_FORMATTER = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

const ENGLISH_MONTH_FORMATTER = new Intl.DateTimeFormat('en', {
  month: 'short',
  timeZone: 'UTC',
})

function parsePhotoDate(photo: Photo): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(photo.takenAt ?? '')

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  return {
    year,
    month,
    day,
    key: year * 10_000 + month * 100 + day,
  }
}

function formatFullDate(date: DateParts) {
  return ENGLISH_DATE_FORMATTER.format(
    new Date(Date.UTC(date.year, date.month - 1, date.day)),
  )
}

function formatMonth(date: DateParts) {
  return ENGLISH_MONTH_FORMATTER.format(
    new Date(Date.UTC(date.year, date.month - 1, date.day)),
  )
}

function getPhotoLocation(photo: Photo) {
  if (photo.locationLabel === 'Not available') {
    return undefined
  }

  return photo.locationLabel
}

function formatLocationRange(startPhoto: Photo, endPhoto?: Photo) {
  const startLocation = getPhotoLocation(startPhoto)

  if (!endPhoto) {
    return startLocation
  }

  const endLocation = getPhotoLocation(endPhoto)

  if (!startLocation && !endLocation) {
    return undefined
  }

  return `${startLocation ?? 'Unknown'} - ${endLocation ?? 'Unknown'}`
}

function getVisibleHeaderState(visiblePhotos: Photo[]): GalleryHeaderState {
  let start: DatedPhoto | undefined
  let end: DatedPhoto | undefined

  visiblePhotos.forEach((photo) => {
    const date = parsePhotoDate(photo)

    if (!date) {
      return
    }

    const datedPhoto = { date, photo }

    if (!start || date.key < start.date.key) {
      start = datedPhoto
    }

    if (!end || date.key > end.date.key) {
      end = datedPhoto
    }
  })

  if (!start || !end) {
    return {}
  }

  const startDate = start.date
  const endDate = end.date

  if (startDate.key === endDate.key) {
    return {
      dateRange: formatFullDate(startDate),
      location: formatLocationRange(start.photo),
    }
  }

  if (startDate.year === endDate.year && startDate.month === endDate.month) {
    return {
      dateRange: `${formatMonth(startDate)} ${startDate.day} - ${endDate.day}, ${startDate.year}`,
      location: formatLocationRange(start.photo, end.photo),
    }
  }

  if (startDate.year === endDate.year) {
    return {
      dateRange: `${formatMonth(startDate)} - ${formatMonth(endDate)} ${startDate.year}`,
      location: formatLocationRange(start.photo, end.photo),
    }
  }

  return {
    dateRange: `${formatMonth(startDate)} ${startDate.year} - ${formatMonth(endDate)} ${endDate.year}`,
    location: formatLocationRange(start.photo, end.photo),
  }
}

export function Masonry({
  photos,
  initialPhotoSlug,
  basePath = '/',
}: MasonryProps) {
  const { activeIndex, setActiveIndex } = useViewerHistory({
    photos,
    initialPhotoSlug,
    basePath,
  })
  const [showHeaderDetail, setShowHeaderDetail] = useState(false)
  const [headerState, setHeaderState] = useState<GalleryHeaderState>({})

  useEffect(() => {
    const handleScroll = () => {
      const nextShowHeaderDetail = window.scrollY > HEADER_SCROLL_THRESHOLD

      setShowHeaderDetail((currentShowHeaderDetail) => {
        if (currentShowHeaderDetail === nextShowHeaderDetail) {
          return currentShowHeaderDetail
        }

        return nextShowHeaderDetail
      })
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    publishGalleryHeaderDetail({
      ...headerState,
      showDateRange: showHeaderDetail && !!headerState.dateRange,
    })
  }, [headerState, showHeaderDetail])

  useEffect(() => {
    return () => {
      publishGalleryHeaderDetail({ showDateRange: false })
    }
  }, [])

  const handleVisiblePhotosChange = useCallback((visiblePhotos: Photo[]) => {
    const nextHeaderState = getVisibleHeaderState(visiblePhotos)

    setHeaderState((currentState) => {
      if (
        currentState.dateRange === nextHeaderState.dateRange &&
        currentState.location === nextHeaderState.location
      ) {
        return currentState
      }

      return nextHeaderState
    })
  }, [])

  const gridProps = useMemo<MasonryGridProps>(
    () => ({
      photos,
      onOpen: setActiveIndex,
      onVisiblePhotosChange: handleVisiblePhotosChange,
    }),
    [handleVisiblePhotosChange, photos, setActiveIndex],
  )

  return (
    <>
      <MasonryGrid {...gridProps} />

      {activeIndex !== null && (
        <Viewer
          photos={photos}
          activeIndex={activeIndex}
          onClose={() => setActiveIndex(null)}
          onChange={setActiveIndex}
        />
      )}
    </>
  )
}
