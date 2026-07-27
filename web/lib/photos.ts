import { encodePathSegment, normalizePathSegment } from './url-segments'

export interface PhotoAsset {
  url: string
  width: number
  height: number
  bytes: number
  mime: string
}

export interface PhotoCamera {
  make?: string
  model?: string
  lens?: string
  focalLengthMm?: number
  focalLengthIn35mm?: number
  aperture?: number
  shutter?: string
  iso?: number
  exposureProgram?: string
  exposureMode?: string
  meteringMode?: string
  whiteBalance?: string
  flash?: string
  sceneCaptureType?: string
  brightnessEv?: number
  maxAperture?: number
  sensingMethod?: string
}

export interface PhotoImage {
  orientation?: number
  colorSpace?: string
  isLivePhoto?: boolean
  bitDepth?: number
}

export interface PhotoLocation {
  lat: number
  lng: number
  alt?: number
}

export interface PhotoManifestEntry {
  original: PhotoAsset
  thumbnail: PhotoAsset
  thumbHash: string
  title: string
  takenAt: string
  camera: PhotoCamera
  image: PhotoImage
  location?: PhotoLocation
}

export interface Photo extends PhotoManifestEntry {
  id: string
  index: number
  slug: string
  fileName: string
  albumKey: string
  albumLabel: string
  locationLabel: string
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

export function getPhotoPath(slug: string) {
  return `/photos/${encodePathSegment(slug)}`
}
