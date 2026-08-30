import type { Photo } from '@/lib/photo'

export function formatCameraLabel(photo: Photo) {
  const label = [photo.camera.make, photo.camera.model]
    .filter(Boolean)
    .join(' ')

  return label || null
}

export function findCameraLabel(photos: readonly Photo[]) {
  for (const photo of photos) {
    const label = formatCameraLabel(photo)

    if (label) {
      return label
    }
  }

  return null
}
