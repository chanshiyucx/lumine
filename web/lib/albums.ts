import type { Photo } from './photo'
import { encodePathSegment, normalizePathSegment } from './url-segments'

const DATED_ALBUM_PATTERN = /^(\d{4})(\d{2})(\d{2})-(.+)$/

interface AlbumDescriptor {
  key: string
  title: string
  date: string
}

export interface Album extends AlbumDescriptor {
  photos: [Photo, ...Photo[]]
}

const descriptorCache = new Map<string, AlbumDescriptor>()

export function getAlbumPath(albumKey: string) {
  return `/albums/${encodePathSegment(albumKey)}`
}

export function normalizeAlbumKey(albumKey: string) {
  return normalizePathSegment(albumKey)
}

export function getAlbumKeyFromAssetPath(pathname: string) {
  const albumKey = pathname.split('/').at(-2)

  if (!albumKey) {
    throw new Error(`Photo asset path has no album folder: ${pathname}`)
  }

  return normalizeAlbumKey(albumKey)
}

function humanizeAlbumTitle(value: string) {
  return value
    .replaceAll('-', ' ')
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, '$1 $2')
    .replace(/([\p{Ll}\d])(\p{Lu})/gu, '$1 $2')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

function parseAlbumDate(year: string, month: string, day: string) {
  const numericYear = Number(year)
  const numericMonth = Number(month)
  const numericDay = Number(day)
  const date = new Date(Date.UTC(numericYear, numericMonth - 1, numericDay))

  if (
    date.getUTCFullYear() !== numericYear ||
    date.getUTCMonth() !== numericMonth - 1 ||
    date.getUTCDate() !== numericDay
  ) {
    throw new Error(`Invalid album date: ${year}-${month}-${day}`)
  }

  return `${year}-${month}-${day}`
}

function parseAlbumDescriptor(albumKey: string): AlbumDescriptor {
  const match = DATED_ALBUM_PATTERN.exec(albumKey)

  if (!match) {
    throw new Error(`Invalid album folder: ${albumKey}`)
  }

  const title = humanizeAlbumTitle(match[4])

  if (!title) {
    throw new Error(`Invalid album title: ${albumKey}`)
  }

  return {
    key: albumKey,
    title,
    date: parseAlbumDate(match[1], match[2], match[3]),
  }
}

export function getAlbumDescriptor(albumKey: string) {
  const cachedDescriptor = descriptorCache.get(albumKey)

  if (cachedDescriptor) {
    return cachedDescriptor
  }

  const descriptor = parseAlbumDescriptor(albumKey)
  descriptorCache.set(albumKey, descriptor)

  return descriptor
}

export function formatAlbumDateCompact(date: string) {
  return date.replaceAll('-', '.')
}
