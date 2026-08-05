import { z } from 'zod'
import { MEDIA_ORIGIN_ENV } from './env'

const mediaOriginSchema = z.url()

export const MEDIA_PATHS = {
  albumMap: 'map.json',
  photoManifest: 'manifest.json',
} as const

function getMediaOrigin() {
  const parsedOrigin = mediaOriginSchema.safeParse(
    process.env[MEDIA_ORIGIN_ENV],
  )

  if (!parsedOrigin.success) {
    throw new Error(
      `Missing or invalid ${MEDIA_ORIGIN_ENV}. Set it to the media host origin, for example https://cloud.example.com.`,
    )
  }

  return new URL('/', parsedOrigin.data)
}

export function getMediaUrl(pathname: string) {
  return new URL(pathname.replace(/^\/+/, ''), getMediaOrigin()).toString()
}
