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

function createAlbum(photo: Photo): Album {
  return {
    key: photo.albumKey,
    label: photo.albumLabel,
    photos: [photo],
  }
}

export function getAlbums(photos: Photo[]) {
  const albumsByKey = new Map<string, Album>()

  for (const photo of photos) {
    const album = albumsByKey.get(photo.albumKey)

    if (album) {
      album.photos.push(photo)
      continue
    }

    albumsByKey.set(photo.albumKey, createAlbum(photo))
  }

  return Array.from(albumsByKey.values())
}

export function getAlbumByKey(photos: Photo[], albumKey: string) {
  let matchingAlbum: Album | undefined

  for (const photo of photos) {
    if (photo.albumKey !== albumKey) {
      continue
    }

    if (matchingAlbum) {
      matchingAlbum.photos.push(photo)
      continue
    }

    matchingAlbum = createAlbum(photo)
  }

  return matchingAlbum
}
