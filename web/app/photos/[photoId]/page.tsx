import type { Metadata } from 'next'
import { PhotoGallery } from '@/components/gallery'
import { siteConfig } from '@/lib/site-config'
import { loadPhotoRouteData } from './_data'

type PhotoPageProps = PageProps<'/photos/[photoId]'>

export function generateStaticParams() {
  return []
}

export async function generateMetadata({
  params,
}: PhotoPageProps): Promise<Metadata> {
  const { photo } = await loadPhotoRouteData(params)

  return {
    title: photo.title,
    openGraph: {
      title: photo.title,
      description: siteConfig.description,
    },
    twitter: {
      card: 'summary_large_image',
      title: photo.title,
      description: siteConfig.description,
    },
  }
}

export default async function PhotoPage({ params }: PhotoPageProps) {
  const { photo, photos } = await loadPhotoRouteData(params)

  return <PhotoGallery photos={photos} initialPhotoSlug={photo.slug} />
}
