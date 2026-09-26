import 'server-only'
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
