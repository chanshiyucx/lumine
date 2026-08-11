import { getAlbumDescriptor } from '@/lib/albums'
import { formatReadableDate } from '@/lib/date'
import type { Photo } from '@/lib/photo'

export interface GalleryHeaderState {
  date?: string
  location?: string
}

export function getGalleryHeaderState(
  photos: readonly Pick<Photo, 'albumKey' | 'takenAt'>[],
): GalleryHeaderState {
  const coverPhoto = photos[0]
  if (!coverPhoto) {
    return {}
  }

  const date = formatReadableDate(coverPhoto.takenAt)
  const location = getAlbumDescriptor(coverPhoto.albumKey).title

  return { date, location }
}
