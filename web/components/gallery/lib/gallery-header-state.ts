import { getAlbumDescriptor } from '@/lib/album'
import { formatReadableDate } from '@/lib/date'
import type { Photo } from '@/lib/photo'

export interface GalleryHeaderState {
  date?: string
  location?: string
}

export function getGalleryHeaderState(
  photo: Pick<Photo, 'albumKey' | 'takenAt'> | undefined,
): GalleryHeaderState {
  if (!photo) {
    return {}
  }

  const date = formatReadableDate(photo.takenAt)
  const location = getAlbumDescriptor(photo.albumKey).title

  return { date, location }
}
