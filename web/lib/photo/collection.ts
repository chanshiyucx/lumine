import 'server-only'
import { cache } from 'react'
import { z } from 'zod'
import { createPhotoSlug, type PhotoAsset, type PhotoCollection } from '.'
import { getAlbumKeyFromAssetPath } from '../albums'
import { getMediaUrl, MEDIA_PATHS } from '../media-url'

const PHOTO_MANIFEST_REVALIDATE_SECONDS = 30

const photoAssetSchema = z.strictObject({
  url: z.string().min(1),
  width: z.number().positive(),
  height: z.number().positive(),
  bytes: z.number().nonnegative(),
  mime: z.string().min(1),
})

const photoCameraSchema = z.strictObject({
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
  maxAperture: z.number().positive().optional(),
  sensingMethod: z.string().min(1).optional(),
})

const photoImageSchema = z.strictObject({
  orientation: z.number().int().positive().optional(),
  colorSpace: z.string().min(1).optional(),
  isLivePhoto: z.boolean().optional(),
  bitDepth: z.number().int().positive().optional(),
})

const photoLocationSchema = z.strictObject({
  lat: z.number(),
  lng: z.number(),
  alt: z.number().optional(),
})

const photoManifestSchema = z.strictObject({
  original: photoAssetSchema,
  thumbnail: photoAssetSchema,
  thumbHash: z.base64().min(8).max(36),
  title: z.string().min(1),
  takenAt: z.iso.datetime({ offset: true }),
  location: photoLocationSchema.optional(),
  camera: photoCameraSchema,
  image: photoImageSchema,
})

const manifestSchema = z.strictObject({
  version: z.literal(2),
  updatedAt: z.string().min(1),
  photos: z.array(photoManifestSchema),
})

function resolveAssetUrl(pathname: string) {
  return getMediaUrl(pathname)
}

function normalizeAsset(asset: z.infer<typeof photoAssetSchema>): PhotoAsset {
  return {
    ...asset,
    url: resolveAssetUrl(asset.url),
  }
}

function getFileNameFromAssetPath(pathname: string) {
  const rawFileName = pathname.split('/').pop() ?? 'unknown'

  return rawFileName.replace(/\.[^/.]+$/, '')
}

async function fetchManifestJson() {
  const manifestUrl = getMediaUrl(MEDIA_PATHS.photoManifest)
  const response = await fetch(manifestUrl, {
    next: { revalidate: PHOTO_MANIFEST_REVALIDATE_SECONDS },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch photo manifest from ${manifestUrl} (${response.status} ${response.statusText})`,
    )
  }

  let manifestJson: unknown

  try {
    manifestJson = await response.json()
  } catch (error) {
    throw new Error(
      `Failed to parse photo manifest JSON from ${manifestUrl}: ${String(error)}`,
    )
  }

  return manifestSchema.parse(manifestJson)
}

export const getPhotoCollection = cache(async (): Promise<PhotoCollection> => {
  const manifest = await fetchManifestJson()
  const photos = manifest.photos.slice().reverse()

  return {
    updatedAt: manifest.updatedAt,
    photos: photos.map((photo, index) => {
      const original = normalizeAsset(photo.original)
      const thumbnail = normalizeAsset(photo.thumbnail)

      return {
        ...photo,
        index,
        id: photo.original.url,
        slug: createPhotoSlug(photo.title),
        fileName: getFileNameFromAssetPath(photo.original.url),
        albumKey: getAlbumKeyFromAssetPath(photo.original.url),
        aspectRatio: thumbnail.width / thumbnail.height,
        original,
        thumbnail,
      }
    }),
  }
})
