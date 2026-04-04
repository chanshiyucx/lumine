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

const photoManifestSchema = z.object({
  original: photoAssetSchema,
  thumbnail: photoAssetSchema,
  blurhash: z.string().min(6),
  title: z.string().min(1),
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

export interface GalleryPhoto {
  id: string
  index: number
  title: string
  alt: string
  albumKey: string
  blurhash: string
  blurDataUrl: string
  aspectRatio: number
  original: GalleryPhotoAsset
  thumbnail: GalleryPhotoAsset
}

export interface PhotoCollection {
  version: number
  updatedAt: string
  albumLabel: string
  photos: GalleryPhoto[]
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

function normalizeAsset(
  asset: z.infer<typeof photoAssetSchema>,
): GalleryPhotoAsset {
  return {
    ...asset,
    url: resolveAssetUrl(asset.url),
  }
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
      title: photo.title,
      alt: `${photo.title}, frame ${index + 1}`,
      albumKey: photo.original.url.split('/')[1] ?? 'gallery',
      blurhash: photo.blurhash,
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
