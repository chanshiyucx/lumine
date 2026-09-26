import 'server-only'
import { cache } from 'react'
import { z } from 'zod'
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
  const mapUrl = getAlbumMapUrl()
  const response = await fetch(mapUrl, {
    next: { revalidate: ALBUM_MAP_REVALIDATE_SECONDS },
  })

  if (response.status === 404) {
    return new Map<string, AlbumLocation>()
  }

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

  const { locations } = albumMapSchema.parse(mapJson)

  return new Map(
    Object.entries(locations).map(([key, location]) => [
      normalizeAlbumKey(key),
      location,
    ]),
  )
})
