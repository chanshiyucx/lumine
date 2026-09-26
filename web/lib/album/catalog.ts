import 'server-only'
import { cache } from 'react'
import { getPhotoCollection } from '@/lib/photo/collection'
import { normalizeAlbumKey, type Album } from '.'

function compareAlbums(left: Album, right: Album) {
  return right.date.localeCompare(left.date)
}

export const getAlbumCatalog = cache(async () => {
  const { photos } = await getPhotoCollection()
  const albumsByKey = new Map<string, Album>()

  for (const photo of photos) {
    const descriptor = photo.album
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
      albumsByKey.get(normalizeAlbumKey(albumKey)),
  }
})
