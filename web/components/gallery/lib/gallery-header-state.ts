import { getAlbumDescriptor } from '@/lib/album'
import type { Photo } from '@/lib/photo'

export interface GalleryHeaderState {
  date?: string
  location?: string
}

export function getGalleryHeaderState(
  photo: Pick<Photo, 'albumKey' | 'captureTime'> | undefined,
): GalleryHeaderState {
  if (!photo) {
    return {}
  }

  const date = photo.captureTime.date
  const location = getAlbumDescriptor(photo.albumKey).title

  return { date, location }
}
