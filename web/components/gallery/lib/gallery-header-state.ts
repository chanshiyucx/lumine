import type { Photo } from '@/lib/photo'

interface DateParts {
  year: number
  month: number
  day: number
  key: number
}

export interface GalleryHeaderState {
  dateRange?: string
  location?: string
}

interface DatedPhoto {
  date: DateParts
  photo: Pick<Photo, 'locationLabel' | 'takenAt'>
}

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

function parsePhotoDate(photo: Pick<Photo, 'takenAt'>): DateParts | null {
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

function getPhotoLocation(photo: Pick<Photo, 'locationLabel'>) {
  if (photo.locationLabel === 'Not available') {
    return undefined
  }

  return photo.locationLabel
}

function formatLocationRange(
  startPhoto: Pick<Photo, 'locationLabel'>,
  endPhoto?: Pick<Photo, 'locationLabel'>,
) {
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

export function getGalleryHeaderState(
  visiblePhotos: readonly Pick<Photo, 'locationLabel' | 'takenAt'>[],
): GalleryHeaderState {
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
