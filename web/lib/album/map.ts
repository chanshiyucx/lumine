import 'server-only'
import { MAP_PREVIEW_CAPACITY } from '@/lib/map-config'
import { getPhotoCollection } from '@/lib/photo/collection'
import { getAlbumPath, getPhotoPath } from '@/lib/route-paths'
import { formatAlbumDateCompact, type Album } from '.'
import { getAlbumCatalog } from './catalog'
import { getAlbumMapLocations } from './locations'

export interface AlbumMapCover {
  href: string
  thumbHash: string
  thumbnail: {
    url: string
    width: number
    height: number
  }
}

interface MapItemBase {
  key: string
  href: string
  label: string
  dateLabel: string
  location: {
    lat: number
    lng: number
  }
  covers: [AlbumMapCover, ...AlbumMapCover[]]
}

export interface AlbumMapItem extends MapItemBase {
  kind: 'album'
  photoCount: number
}

export interface PhotoMapItem extends MapItemBase {
  kind: 'photo'
  cameraName: string | null
  location: MapItemBase['location'] & { alt?: number }
}

export type MapItem = AlbumMapItem | PhotoMapItem

export async function getPhotoMapItems(): Promise<PhotoMapItem[]> {
  const { photos } = await getPhotoCollection()

  return photos.flatMap((photo) =>
    photo.location
      ? [
          {
            kind: 'photo' as const,
            key: `photo:${photo.id}`,
            href: getPhotoPath(photo.slug),
            label: photo.title,
            dateLabel: photo.captureTime.date,
            cameraName: photo.cameraName,
            location: photo.location,
            covers: [getCover(photo)],
          },
        ]
      : [],
  )
}

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

function getCovers(
  firstPhoto: Album['photos'][number],
  remainingPhotos: Album['photos'][number][],
): AlbumMapItem['covers'] {
  return [
    getCover(firstPhoto),
    ...remainingPhotos.slice(0, MAP_PREVIEW_CAPACITY - 1).map(getCover),
  ]
}

export async function getAlbumMapItems(): Promise<AlbumMapItem[]> {
  const [catalog, locations] = await Promise.all([
    getAlbumCatalog(),
    getAlbumMapLocations(),
  ])

  return catalog.albums.flatMap((album) => {
    const mappedLocation = locations.get(album.key)
    if (!mappedLocation) {
      return []
    }

    const photosWithoutLocation = album.photos.filter(
      (photo) => !photo.location,
    )
    const [firstPhoto, ...remainingPhotos] = photosWithoutLocation
    if (!firstPhoto) return []

    return [
      {
        kind: 'album' as const,
        key: album.key,
        href: getAlbumPath(album.key),
        label: album.title,
        dateLabel: formatAlbumDateCompact(album.date),
        photoCount: photosWithoutLocation.length,
        location: {
          lat: mappedLocation.lat,
          lng: mappedLocation.lng,
        },
        covers: getCovers(firstPhoto, remainingPhotos),
      },
    ]
  })
}
