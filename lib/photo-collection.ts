import 'server-only'
import { cache } from 'react'
import { z } from 'zod'
import { blurhashToDataUrl } from './blurhash'
import {
  createPhotoSlug,
  type GalleryPhotoAsset,
  type PhotoCollection,
} from './photos'
import { siteConfig } from './site-config'

const PHOTO_MANIFEST_URL_ENV = 'PHOTO_MANIFEST_URL'

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

function getManifestUrl() {
  const manifestUrl = process.env[PHOTO_MANIFEST_URL_ENV]
  const parsedManifestUrl = z.url().safeParse(manifestUrl)

  if (!parsedManifestUrl.success) {
    throw new Error(
      `Missing or invalid ${PHOTO_MANIFEST_URL_ENV}. Set it to the remote manifest.json URL.`,
    )
  }

  return parsedManifestUrl.data
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

async function fetchManifestJson() {
  const manifestUrl = getManifestUrl()
  const response = await fetch(manifestUrl, { cache: 'force-cache' })

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

  return {
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
})

export async function getPhotoIndexBySlug(slug: string) {
  const photoCollection = await getPhotoCollection()

  return photoCollection.photos.findIndex((photo) => photo.slug === slug)
}

export async function getPhotoBySlug(slug: string) {
  const photoCollection = await getPhotoCollection()

  return photoCollection.photos.find((photo) => photo.slug === slug)
}
