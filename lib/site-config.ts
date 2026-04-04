import { z } from 'zod'

export const siteConfigSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  locale: z.string().min(2),
  mediaOrigin: z.string().url(),
})

export const siteConfig = siteConfigSchema.parse({
  name: 'Lumine',
  title: 'Lumine',
  description: 'Still frames, quiet light, and the shape of a journey.',
  locale: 'en',
  mediaOrigin: 'https://pub-efa9752d1df7473ba09aff6dd1a9835a.r2.dev/',
})

export type SiteConfig = z.infer<typeof siteConfigSchema>
