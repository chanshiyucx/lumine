import 'server-only'
import { cache } from 'react'
import {
  getAlbumKeyFromAssetPath,
  parseAlbumDescriptor,
  type AlbumDescriptor,
} from '@/lib/album'
import { getAlbumMapLocations } from '@/lib/album/locations'
import { getPhotoAssetUrl, getPhotoManifestUrl } from '@/lib/media-url'
import { createPhotoSlug, type PhotoAsset, type PhotoCollection } from '.'
import { formatCaptureTime, resolveTakenAt } from './capture-time'
import { manifestSchema, type PhotoManifest } from './manifest'

const PHOTO_MANIFEST_REVALIDATE_SECONDS = 30

type AlbumLocations = Awaited<ReturnType<typeof getAlbumMapLocations>>

type AssetUrlResolver = (pathname: string) => string

function getFileNameFromAssetPath(pathname: string) {
  const rawFileName = pathname.split('/').pop() ?? 'unknown'

  return rawFileName.replace(/\.[^/.]+$/, '')
}

function getPhotoFormat(asset: PhotoAsset) {
  const extension = /\.([a-z\d]+)$/i.exec(asset.url)?.[1]

  return (extension ?? asset.mime.replace('image/', '')).toUpperCase()
}

export async function fetchPhotoManifest(
  manifestUrl: string,
  init: RequestInit,
) {
  const response = await fetch(manifestUrl, init)

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
  const [manifest, locations] = await Promise.all([
    fetchPhotoManifest(getPhotoManifestUrl(), {
      next: { revalidate: PHOTO_MANIFEST_REVALIDATE_SECONDS },
    }),
    getAlbumMapLocations(),
  ])

  return toPhotoCollection(manifest, locations, getPhotoAssetUrl)
})

export function toPhotoCollection(
  manifest: PhotoManifest,
  locations: AlbumLocations,
  resolveAssetUrl: AssetUrlResolver,
): PhotoCollection {
  const normalizeAsset = (asset: PhotoAsset): PhotoAsset => ({
    ...asset,
    url: resolveAssetUrl(asset.url),
  })
  const albumsByKey = new Map<string, AlbumDescriptor>()
  const photos = manifest.photos.map((photo) => {
    const original = normalizeAsset(photo.original)
    const thumbnail = normalizeAsset(photo.thumbnail)
    const albumKey = getAlbumKeyFromAssetPath(photo.original.url)
    const timeZone = locations.get(albumKey)?.timeZone
    // From here on every takenAt carries a UTC offset.
    const takenAt = resolveTakenAt(photo.takenAt, timeZone)
    let album = albumsByKey.get(albumKey)

    if (!album) {
      album = parseAlbumDescriptor(albumKey)
      albumsByKey.set(albumKey, album)
    }

    return {
      ...photo,
      takenAt,
      id: photo.original.url,
      slug: createPhotoSlug(photo.title),
      fileName: getFileNameFromAssetPath(photo.original.url),
      album,
      format: getPhotoFormat(photo.original),
      cameraName:
        [photo.camera.make, photo.camera.model].filter(Boolean).join(' ') ||
        null,
      captureTime: formatCaptureTime(takenAt, timeZone),
      aspectRatio: thumbnail.width / thumbnail.height,
      original,
      thumbnail,
    }
  })

  return {
    updatedAt: manifest.updatedAt,
    photos: photos.sort(
      (left, right) => Date.parse(right.takenAt) - Date.parse(left.takenAt),
    ),
  }
}
