import type { Metadata } from 'next'
import { PhotoGallery } from '@/components/gallery'
import { createPageMetadata } from '@/lib/page-metadata'
import { loadPhotoRouteData } from './_data'

type PhotoPageProps = PageProps<'/photos/[photoId]'>

export function generateStaticParams() {
  return []
}

export async function generateMetadata({
  params,
}: PhotoPageProps): Promise<Metadata> {
  const { photo } = await loadPhotoRouteData(params)

  return createPageMetadata(photo.title)
}

export default async function PhotoPage({ params }: PhotoPageProps) {
  const { photo, photos } = await loadPhotoRouteData(params)

  return <PhotoGallery photos={photos} initialPhotoSlug={photo.slug} />
}
