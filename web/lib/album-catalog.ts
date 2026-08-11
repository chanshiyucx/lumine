import 'server-only'
import { cache } from 'react'
import { getAlbumDescriptor, type Album } from './albums'
import { getPhotoCollection } from './photo/collection'
import { decodePathSegment } from './url-segments'

function compareAlbums(left: Album, right: Album) {
  return right.date.localeCompare(left.date)
}

export const getAlbumCatalog = cache(async () => {
  const { photos } = await getPhotoCollection()
  const albumsByKey = new Map<string, Album>()

  for (const photo of photos) {
    const descriptor = getAlbumDescriptor(photo.albumKey)
    const album = albumsByKey.get(descriptor.key)

    if (album) {
      album.photos.push(photo)
    } else {
      albumsByKey.set(descriptor.key, {
        ...descriptor,
        photos: [photo],
      })
    }
  }

  const albums = Array.from(albumsByKey.values()).sort(compareAlbums)

  return {
    albums,
    getByKey: (albumKey: string) =>
      albumsByKey.get(decodePathSegment(albumKey)),
  }
})
