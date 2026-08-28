import type { Photo } from '@/lib/photo'

export function formatCameraLabel(photo: Photo) {
  const label = [photo.camera.make, photo.camera.model]
    .filter(Boolean)
    .join(' ')

  return label || null
}
