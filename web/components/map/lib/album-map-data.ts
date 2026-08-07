import 'server-only'
import { cache } from 'react'
import { z } from 'zod'
import { getAlbumPath, type Album } from '@/lib/albums'
import { getMediaUrl, MEDIA_PATHS } from '@/lib/media-url'
import { getPhotoPath } from '@/lib/photo'

export interface AlbumMapCover {
  href: string
  thumbHash: string
  url: string
  width: number
  height: number
}

export interface AlbumMapItem {
  key: string
  href: string
  label: string
  dateLabel: string
  photoCount: number
  location: {
    lat: number
    lng: number
  }
  covers: AlbumMapCover[]
}

const albumMapSchema = z.object({
  version: z.literal(1),
  locations: z.record(
    z.string(),
    z.object({
      label: z.string().min(1),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
  ),
})

const ALBUM_MAP_REVALIDATE_SECONDS = 30
const MAX_COVERS = 4

function normalizeAlbumKey(key: string) {
  return key.normalize('NFC')
}

function getDateLabel(album: Album) {
  return album.label.split(' · ')[1] ?? ''
}

function getCovers(album: Album): AlbumMapCover[] {
  return album.photos.slice(0, MAX_COVERS).map((photo) => ({
    href: getPhotoPath(photo.slug),
    thumbHash: photo.thumbHash,
    url: photo.thumbnail.url,
    width: photo.thumbnail.width,
    height: photo.thumbnail.height,
  }))
}

const fetchAlbumMapData = cache(async () => {
  const mapUrl = getMediaUrl(MEDIA_PATHS.albumMap)
  const response = await fetch(mapUrl, {
    next: { revalidate: ALBUM_MAP_REVALIDATE_SECONDS },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch album map from ${mapUrl} (${response.status} ${response.statusText})`,
    )
  }

  let mapJson: unknown

  try {
    mapJson = await response.json()
  } catch (error) {
    throw new Error(`Failed to parse album map JSON from ${mapUrl}: ${error}`)
  }

  return albumMapSchema.parse(mapJson)
})

export async function getAlbumMapItems(
  albums: Album[],
): Promise<AlbumMapItem[]> {
  const albumMapData = await fetchAlbumMapData()
  const locations = new Map(
    Object.entries(albumMapData.locations).map(([key, location]) => [
      normalizeAlbumKey(key),
      location,
    ]),
  )

  return albums.flatMap((album) => {
    const normalizedKey = normalizeAlbumKey(album.key)
    const mappedLocation = locations.get(normalizedKey)
    if (!mappedLocation) {
      return []
    }

    return [
      {
        key: album.key,
        href: getAlbumPath(album.key),
        label: mappedLocation.label,
        dateLabel: getDateLabel(album),
        photoCount: album.photos.length,
        location: {
          lat: mappedLocation.lat,
          lng: mappedLocation.lng,
        },
        covers: getCovers(album),
      },
    ]
  })
}
