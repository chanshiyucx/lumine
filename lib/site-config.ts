import { z } from 'zod'

export const siteConfigSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  locale: z.string().min(2),
})

export const siteConfig = siteConfigSchema.parse({
  name: 'Lumine',
  title: 'Lumine',
  description: 'Photo gallery',
  locale: 'en',
})

export type SiteConfig = z.infer<typeof siteConfigSchema>
