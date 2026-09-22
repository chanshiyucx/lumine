import type { Metadata } from 'next'
import { siteConfig } from '@/lib/site-config'

export const socialMetadata = {
  openGraph: {
    siteName: siteConfig.name,
    type: 'website',
    description: siteConfig.description,
  },
  twitter: {
    card: 'summary_large_image',
    description: siteConfig.description,
  },
} satisfies Metadata

export function createPageMetadata(title: string): Metadata {
  return {
    title,
    openGraph: { ...socialMetadata.openGraph, title },
    twitter: { ...socialMetadata.twitter, title },
  }
}
