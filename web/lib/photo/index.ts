import type { AlbumDescriptor } from '@/lib/album'
import { normalizePathSegment } from '../url-segments'
import type { PhotoManifestEntry } from './manifest'

export type {
  PhotoAsset,
  PhotoCamera,
  PhotoImage,
  PhotoLocation,
  PhotoManifestEntry,
} from './manifest'

export interface PhotoCaptureTime {
  date: string
  dateTime: string
  timeZone: string
}

export interface Photo extends PhotoManifestEntry {
  id: string
  slug: string
  fileName: string
  album: AlbumDescriptor
  format: string
  cameraName: string | null
  captureTime: PhotoCaptureTime
  aspectRatio: number
}

export interface PhotoCollection {
  updatedAt: string
  photos: Photo[]
}

export function createPhotoSlug(title: string) {
  return normalizePathSegment(title.trim().replaceAll(/\s+/g, '-')).replaceAll(
    '/',
    '-',
  )
}
