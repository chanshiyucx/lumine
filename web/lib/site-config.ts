import { z } from 'zod'

const siteConfigSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  author: z.string().min(1),
  locale: z.string().min(2),
  host: z.string().url(),
})

export const siteConfig = siteConfigSchema.parse({
  name: 'Lumine',
  title: 'Lumine',
  description: 'Essence in Every Frame.',
  author: 'Shiyu',
  locale: 'en',
  host: 'https://gallery.shiyu.me/',
})

export type SiteConfig = z.infer<typeof siteConfigSchema>
