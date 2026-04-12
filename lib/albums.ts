import type { Photo } from './photos'

export interface Album {
  key: string
  label: string
  photos: Photo[]
}

export function getAlbumPath(albumKey: string) {
  return `/albums/${encodeURIComponent(albumKey)}`
}

export function normalizeAlbumKey(albumKey: string) {
  try {
    return decodeURIComponent(albumKey)
  } catch {
    return albumKey
  }
}

export function getAlbums(photos: Photo[]) {
  const albumsByKey = new Map<string, Album>()

  photos.forEach((photo) => {
    const album = albumsByKey.get(photo.albumKey)

    if (album) {
      album.photos.push(photo)
      return
    }

    albumsByKey.set(photo.albumKey, {
      key: photo.albumKey,
      label: photo.albumLabel,
      photos: [photo],
    })
  })

  return Array.from(albumsByKey.values())
}

export function getAlbumByKey(photos: Photo[], albumKey: string) {
  return getAlbums(photos).find((album) => album.key === albumKey)
}
