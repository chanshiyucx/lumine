import type { Photo } from '@/lib/photo'

export interface GalleryHeaderState {
  date?: string
  location?: string
}

const ENGLISH_DATE_FORMATTER = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

function formatPhotoDate(photo: Pick<Photo, 'takenAt'>) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(photo.takenAt)

  if (!match) {
    return undefined
  }

  const [, year, month, day] = match

  return ENGLISH_DATE_FORMATTER.format(
    new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))),
  )
}

function formatPhotoLocation(photo: Pick<Photo, 'locationLabel'>) {
  if (photo.locationLabel === 'Not available') {
    return undefined
  }

  return photo.locationLabel
}

export function getGalleryHeaderState(
  photos: readonly Pick<Photo, 'locationLabel' | 'takenAt'>[],
): GalleryHeaderState {
  const coverPhoto = photos[0]
  if (!coverPhoto) {
    return {}
  }

  const date = formatPhotoDate(coverPhoto)
  const location = formatPhotoLocation(coverPhoto)

  return { date, location }
}
