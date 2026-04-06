import { z } from 'zod'
import manifestJson from '@/manifest.json'
import { blurhashToDataUrl } from './blurhash'
import { siteConfig } from './site-config'

const photoAssetSchema = z.object({
  url: z.string().min(1),
  width: z.number().positive(),
  height: z.number().positive(),
  bytes: z.number().nonnegative(),
  mime: z.string().min(1),
})

const photoCameraSchema = z.object({
  make: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  lens: z.string().min(1).optional(),
  focalLengthMm: z.number().positive().optional(),
  focalLengthIn35mm: z.number().positive().optional(),
  aperture: z.number().positive().optional(),
  shutter: z.string().min(1).optional(),
  iso: z.number().int().positive().optional(),
  exposureProgram: z.string().min(1).optional(),
  exposureMode: z.string().min(1).optional(),
  meteringMode: z.string().min(1).optional(),
  whiteBalance: z.string().min(1).optional(),
  flash: z.string().min(1).optional(),
  sceneCaptureType: z.string().min(1).optional(),
  brightnessEv: z.number().optional(),
  lightSource: z.string().min(1).optional(),
  software: z.string().min(1).optional(),
  artist: z.string().min(1).optional(),
  maxAperture: z.number().positive().optional(),
})

const photoImageSchema = z.object({
  orientation: z.number().int().positive().optional(),
  colorSpace: z.string().min(1).optional(),
  hasHdr: z.boolean().optional(),
  isLivePhoto: z.boolean().optional(),
  bitDepth: z.number().int().positive().optional(),
})

const photoManifestSchema = z.object({
  original: photoAssetSchema,
  thumbnail: photoAssetSchema,
  blurhash: z.string().min(6),
  title: z.string().min(1),
  takenAt: z.string().min(1).optional(),
  camera: photoCameraSchema.optional(),
  image: photoImageSchema.optional(),
})

const manifestSchema = z.object({
  version: z.number().int().positive(),
  updatedAt: z.string().min(1),
  photos: z.array(photoManifestSchema),
})

const manifest = manifestSchema.parse(manifestJson)

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

export function getPhotoIndexBySlug(slug: string) {
  return photoCollection.photos.findIndex((photo) => photo.slug === slug)
}

export function getPhotoBySlug(slug: string) {
  return photoCollection.photos.find((photo) => photo.slug === slug)
}

function resolveAssetUrl(pathname: string) {
  return new URL(pathname, siteConfig.mediaOrigin).toString()
}

function formatAlbumLabel(originalPath: string | undefined) {
  const folder = originalPath?.split('/')[1]

  if (!folder) {
    return 'Selected Frames'
  }

  const match = /^(\d{4})(\d{2})(\d{2})-(.+)$/.exec(folder)

  if (!match) {
    return folder.replaceAll('-', ' ')
  }

  const [, year, month, day, location] = match

  return `${location.replaceAll('-', ' ')} · ${year}.${month}.${day}`
}

function formatLocationLabel(originalPath: string | undefined) {
  const folder = originalPath?.split('/')[1]

  if (!folder) {
    return 'Not available'
  }

  const match = /^(\d{4})(\d{2})(\d{2})-(.+)$/.exec(folder)

  if (!match) {
    return folder.replaceAll('-', ' ')
  }

  return match[4].replaceAll('-', ' ')
}

function normalizeAsset(
  asset: z.infer<typeof photoAssetSchema>,
): GalleryPhotoAsset {
  return {
    ...asset,
    url: resolveAssetUrl(asset.url),
  }
}

function getFileNameFromAssetPath(pathname: string) {
  const rawFileName = pathname.split('/').pop() ?? 'unknown'

  return rawFileName.replace(/\.[^/.]+$/, '')
}

function getBlurPreviewSize(width: number, height: number) {
  const maxSide = 24

  if (width >= height) {
    return {
      width: maxSide,
      height: Math.max(1, Math.round((maxSide * height) / width)),
    }
  }

  return {
    width: Math.max(1, Math.round((maxSide * width) / height)),
    height: maxSide,
  }
}

export const photoCollection: PhotoCollection = {
  version: manifest.version,
  updatedAt: manifest.updatedAt,
  albumLabel: formatAlbumLabel(manifest.photos[0]?.original.url),
  photos: manifest.photos.map((photo, index) => {
    const original = normalizeAsset(photo.original)
    const thumbnail = normalizeAsset(photo.thumbnail)
    const blurPreviewSize = getBlurPreviewSize(
      thumbnail.width,
      thumbnail.height,
    )

    return {
      id: photo.original.url,
      index,
      slug: createPhotoSlug(photo.title),
      title: photo.title,
      fileName: getFileNameFromAssetPath(photo.original.url),
      albumKey: photo.original.url.split('/')[1] ?? 'gallery',
      albumLabel: formatAlbumLabel(photo.original.url),
      locationLabel: formatLocationLabel(photo.original.url),
      blurhash: photo.blurhash,
      blurDataUrl: blurhashToDataUrl(
        photo.blurhash,
        blurPreviewSize.width,
        blurPreviewSize.height,
      ),
      aspectRatio: thumbnail.width / thumbnail.height,
      takenAt: photo.takenAt ?? null,
      camera: photo.camera ?? null,
      image: photo.image ?? null,
      original,
      thumbnail,
    }
  }),
}
