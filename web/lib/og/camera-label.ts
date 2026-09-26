import type { Photo } from '@/lib/photo'

export function findCameraLabel(photos: readonly Photo[]) {
  for (const photo of photos) {
    if (photo.cameraName) {
      return photo.cameraName
    }
  }

  return null
}
