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
import { formatCaptureTime } from './capture-time'
import { manifestSchema } from './manifest'

const PHOTO_MANIFEST_REVALIDATE_SECONDS = 30

function normalizeAsset(asset: PhotoAsset): PhotoAsset {
  return {
    ...asset,
    url: getPhotoAssetUrl(asset.url),
  }
}

function getFileNameFromAssetPath(pathname: string) {
  const rawFileName = pathname.split('/').pop() ?? 'unknown'

  return rawFileName.replace(/\.[^/.]+$/, '')
}

function getPhotoFormat(asset: PhotoAsset) {
  const extension = /\.([a-z\d]+)$/i.exec(asset.url)?.[1]

  return (extension ?? asset.mime.replace('image/', '')).toUpperCase()
}

async function fetchManifestJson() {
  const manifestUrl = getPhotoManifestUrl()
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
  const [manifest, locations] = await Promise.all([
    fetchManifestJson(),
    getAlbumMapLocations(),
  ])
  const photos = manifest.photos.toSorted(
    (left, right) => Date.parse(right.takenAt) - Date.parse(left.takenAt),
  )
  const albumsByKey = new Map<string, AlbumDescriptor>()

  return {
    updatedAt: manifest.updatedAt,
    photos: photos.map((photo) => {
      const original = normalizeAsset(photo.original)
      const thumbnail = normalizeAsset(photo.thumbnail)
      const albumKey = getAlbumKeyFromAssetPath(photo.original.url)
      let album = albumsByKey.get(albumKey)

      if (!album) {
        album = parseAlbumDescriptor(albumKey)
        albumsByKey.set(albumKey, album)
      }

      return {
        ...photo,
        id: photo.original.url,
        slug: createPhotoSlug(photo.title),
        fileName: getFileNameFromAssetPath(photo.original.url),
        album,
        format: getPhotoFormat(photo.original),
        cameraName:
          [photo.camera.make, photo.camera.model].filter(Boolean).join(' ') ||
          null,
        captureTime: formatCaptureTime(
          photo.takenAt,
          locations.get(albumKey)?.timeZone,
        ),
        aspectRatio: thumbnail.width / thumbnail.height,
        original,
        thumbnail,
      }
    }),
  }
})
