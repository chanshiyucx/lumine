import 'server-only'
import { cache } from 'react'
import { z } from 'zod'
import { blurhashToDataUrl } from './blurhash'
import { PHOTO_MANIFEST_URL_ENV } from './env'
import {
  createPhotoSlug,
  type PhotoAsset,
  type PhotoCollection,
} from './photos'
import { siteConfig } from './site-config'

const PHOTO_MANIFEST_REVALIDATE_SECONDS = 30
const DEFAULT_ALBUM_KEY = 'gallery'
const DEFAULT_ALBUM_LABEL = 'Selected Frames'
const DEFAULT_LOCATION_LABEL = 'Not available'
const ALBUM_FOLDER_PATTERN = /^(\d{4})(\d{2})(\d{2})-(.+)$/

const photoAssetSchema = z
  .object({
    url: z.string().min(1),
    width: z.number().positive(),
    height: z.number().positive(),
    bytes: z.number().nonnegative(),
    mime: z.string().min(1),
  })
  .strict()

const photoCameraSchema = z
  .object({
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
  .strict()

const photoImageSchema = z
  .object({
    orientation: z.number().int().positive().optional(),
    colorSpace: z.string().min(1).optional(),
    hasHdr: z.boolean().optional(),
    isLivePhoto: z.boolean().optional(),
    bitDepth: z.number().int().positive().optional(),
  })
  .strict()

const photoLocationSchema = z
  .object({
    lat: z.number(),
    lng: z.number(),
    alt: z.number().optional(),
  })
  .strict()

const photoManifestSchema = z
  .object({
    original: photoAssetSchema,
    thumbnail: photoAssetSchema,
    blurhash: z.string().min(6),
    title: z.string().min(1),
    takenAt: z.string().min(1),
    location: photoLocationSchema.optional(),
    camera: photoCameraSchema,
    image: photoImageSchema,
  })
  .strict()

const manifestSchema = z
  .object({
    version: z.number().int().positive(),
    updatedAt: z.string().min(1),
    photos: z.array(photoManifestSchema),
  })
  .strict()

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

function parseAlbumPath(originalPath: string | undefined) {
  const folder = originalPath?.split('/')[1]

  if (!folder) {
    return null
  }

  const match = ALBUM_FOLDER_PATTERN.exec(folder)

  if (!match) {
    const label = folder.replaceAll('-', ' ')

    return {
      key: folder,
      label,
      locationLabel: label,
    }
  }

  const [, year, month, day, location] = match
  const locationLabel = location.replaceAll('-', ' ')

  return {
    key: folder,
    label: `${locationLabel} · ${year}.${month}.${day}`,
    locationLabel,
  }
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
    version: manifest.version,
    updatedAt: manifest.updatedAt,
    photos: photos.map((photo, index) => {
      const original = normalizeAsset(photo.original)
      const thumbnail = normalizeAsset(photo.thumbnail)
      const album = parseAlbumPath(photo.original.url)
      const blurPreviewSize = getBlurPreviewSize(
        thumbnail.width,
        thumbnail.height,
      )

      return {
        ...photo,
        index,
        id: photo.original.url,
        slug: createPhotoSlug(photo.title),
        fileName: getFileNameFromAssetPath(photo.original.url),
        albumKey: album?.key ?? DEFAULT_ALBUM_KEY,
        albumLabel: album?.label ?? DEFAULT_ALBUM_LABEL,
        locationLabel: album?.locationLabel ?? DEFAULT_LOCATION_LABEL,
        blurDataUrl: blurhashToDataUrl(
          photo.blurhash,
          blurPreviewSize.width,
          blurPreviewSize.height,
        ),
        aspectRatio: thumbnail.width / thumbnail.height,
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
