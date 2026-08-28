export interface SiteConfig {
  name: string
  title: string
  description: string
  author: string
  locale: string
  host: string
}

export const siteConfig = {
  name: 'Lumine',
  title: 'Lumine',
  description: 'Essence in Every Frame.',
  author: 'Shiyu',
  locale: 'en',
  host: 'https://gallery.shiyu.me/',
} satisfies SiteConfig
