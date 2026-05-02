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
  hasHdr?: boolean
  isLivePhoto?: boolean
  bitDepth?: number
}

export interface PhotoLocation {
  lat: number
  lng: number
  alt?: number
}

export interface PhotoAccentPalette {
  accent: string
  surface: string
  rightEdge: string
  bottomEdge: string
  glow: string
}

export interface PhotoManifestEntry {
  original: PhotoAsset
  thumbnail: PhotoAsset
  blurhash: string
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
  blurDataUrl: string
  accentPalette: PhotoAccentPalette
  aspectRatio: number
}

export interface PhotoCollection {
  version: number
  updatedAt: string
  photos: Photo[]
}

export function createPhotoSlug(title: string) {
  return title.trim().replaceAll(/\s+/g, '-').replaceAll('/', '-')
}

export function getPhotoPath(slug: string) {
  return `/photos/${encodeURIComponent(slug)}`
}
