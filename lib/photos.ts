export interface GalleryPhotoAsset {
  url: string
  width: number
  height: number
  bytes: number
  mime: string
}

export interface GalleryPhotoCamera {
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
  lightSource?: string
  software?: string
  artist?: string
  maxAperture?: number
}

export interface GalleryPhotoImage {
  orientation?: number
  colorSpace?: string
  hasHdr?: boolean
  isLivePhoto?: boolean
  bitDepth?: number
}

export interface GalleryPhoto {
  id: string
  index: number
  slug: string
  title: string
  fileName: string
  albumKey: string
  albumLabel: string
  locationLabel: string
  blurhash: string
  blurDataUrl: string
  aspectRatio: number
  takenAt: string | null
  camera: GalleryPhotoCamera | null
  image: GalleryPhotoImage | null
  original: GalleryPhotoAsset
  thumbnail: GalleryPhotoAsset
}

export interface PhotoCollection {
  version: number
  updatedAt: string
  albumLabel: string
  photos: GalleryPhoto[]
}

export function createPhotoSlug(title: string) {
  return title.trim().replaceAll(/\s+/g, '-').replaceAll('/', '-')
}

export function getPhotoPath(slug: string) {
  return `/photos/${encodeURIComponent(slug)}`
}
