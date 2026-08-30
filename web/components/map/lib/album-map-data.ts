import 'server-only'
import { cache } from 'react'
import { z } from 'zod'
import { getAlbumCatalog } from '@/lib/album-catalog'
import {
  formatAlbumDateCompact,
  getAlbumPath,
  normalizeAlbumKey,
  type Album,
} from '@/lib/albums'
import { getAlbumMapUrl } from '@/lib/media-url'
import { getPhotoPath } from '@/lib/photo'

export interface AlbumMapCover {
  href: string
  thumbHash: string
  thumbnail: {
    url: string
    width: number
    height: number
  }
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
  covers: [AlbumMapCover, ...AlbumMapCover[]]
}

const albumMapSchema = z.object({
  version: z.literal(1),
  locations: z.record(
    z.string(),
    z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
  ),
})

const ALBUM_MAP_REVALIDATE_SECONDS = 30
const MAX_COVERS = 3

function getCover(photo: Album['photos'][number]): AlbumMapCover {
  return {
    href: getPhotoPath(photo.slug),
    thumbHash: photo.thumbHash,
    thumbnail: {
      url: photo.thumbnail.url,
      width: photo.thumbnail.width,
      height: photo.thumbnail.height,
    },
  }
}

function getCovers(album: Album): AlbumMapItem['covers'] {
  const [firstPhoto, ...remainingPhotos] = album.photos

  return [
    getCover(firstPhoto),
    ...remainingPhotos.slice(0, MAX_COVERS - 1).map(getCover),
  ]
}

const fetchAlbumMapData = cache(async () => {
  const mapUrl = getAlbumMapUrl()
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

export async function getAlbumMapItems(): Promise<AlbumMapItem[]> {
  const [catalog, albumMapData] = await Promise.all([
    getAlbumCatalog(),
    fetchAlbumMapData(),
  ])
  const locations = new Map(
    Object.entries(albumMapData.locations).map(([key, location]) => [
      normalizeAlbumKey(key),
      location,
    ]),
  )

  return catalog.albums.flatMap((album) => {
    const mappedLocation = locations.get(album.key)
    if (!mappedLocation) {
      return []
    }

    return [
      {
        key: album.key,
        href: getAlbumPath(album.key),
        label: album.title,
        dateLabel: formatAlbumDateCompact(album.date),
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
