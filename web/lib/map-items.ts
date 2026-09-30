import 'server-only'
import { MAP_PREVIEW_CAPACITY } from '@/lib/map-config'
import type { AlbumMapItem, MapCover, PhotoMapItem } from '@/lib/map-types'
import { getPhotoCollection } from '@/lib/photo/collection'
import { getPhotoSummary } from '@/lib/photo/summary'
import { getAlbumPath, getPhotoPath } from '@/lib/route-paths'
import type { Album } from './album'
import { getAlbumCatalog } from './album/catalog'
import { getAlbumMapLocations } from './album/locations'

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
            captureTime: { date: photo.captureTime.date },
            takenAt: photo.takenAt,
            cameraName: photo.cameraName,
            location: photo.location,
            covers: [getCover(photo)],
          },
        ]
      : [],
  )
}

function getCover(photo: Album['photos'][number]): MapCover {
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
    const summary = getPhotoSummary(photosWithoutLocation)

    return [
      {
        kind: 'album' as const,
        key: album.key,
        href: getAlbumPath(album.key),
        label: album.title,
        dateLabel: summary.dateLabel,
        photoCount: photosWithoutLocation.length,
        cameraName: summary.cameraName,
        location: {
          lat: mappedLocation.lat,
          lng: mappedLocation.lng,
        },
        covers: getCovers(firstPhoto, remainingPhotos),
      },
    ]
  })
}
