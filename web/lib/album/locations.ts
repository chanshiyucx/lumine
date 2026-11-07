import 'server-only'
import { cache } from 'react'
import { z } from 'zod'
import { fetchOptionalJson } from '@/lib/fetch-json'
import { getAlbumMapUrl } from '@/lib/media-url'
import { normalizeAlbumKey } from '.'

const albumMapSchema = z.object({
  version: z.literal(1),
  locations: z.record(
    z.string(),
    z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      timeZone: z.string().min(1).optional(),
    }),
  ),
})

type AlbumLocation = z.infer<typeof albumMapSchema>['locations'][string]

const ALBUM_MAP_REVALIDATE_SECONDS = 30

export const getAlbumMapLocations = cache(async () => {
  const albumMap = await fetchOptionalJson(getAlbumMapUrl(), albumMapSchema, {
    next: { revalidate: ALBUM_MAP_REVALIDATE_SECONDS },
  })

  if (!albumMap) {
    return new Map<string, AlbumLocation>()
  }

  return new Map(
    Object.entries(albumMap.locations).map(([key, location]) => [
      normalizeAlbumKey(key),
      location,
    ]),
  )
})
