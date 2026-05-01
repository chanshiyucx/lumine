import { z } from 'zod'
import { PHOTO_MANIFEST_URL_ENV } from './env'

const siteConfigSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  locale: z.string().min(2),
  mediaOrigin: z.url(),
})

function getMediaOrigin() {
  const manifestUrl = process.env[PHOTO_MANIFEST_URL_ENV]
  const parsedManifestUrl = z.url().safeParse(manifestUrl)

  if (!parsedManifestUrl.success) {
    throw new Error(
      `Missing or invalid ${PHOTO_MANIFEST_URL_ENV}. Set it to the remote manifest.json URL.`,
    )
  }

  return new URL('/', parsedManifestUrl.data).toString()
}

export const siteConfig = siteConfigSchema.parse({
  name: 'Lumine',
  title: 'Lumine',
  description: 'Still frames, quiet light, and the shape of a journey.',
  locale: 'en',
  mediaOrigin: getMediaOrigin(),
})

export type SiteConfig = z.infer<typeof siteConfigSchema>
