import type { Metadata } from 'next'
import { PhotoGallery } from '@/components/gallery'
import { createPageMetadata } from '@/lib/page-metadata'
import { decodeEncodedPathSegment } from '@/lib/url-segments'
import { loadPhotoRouteData } from './_data'

type PhotoPageProps = PageProps<'/photos/[photoId]'>

export function generateStaticParams() {
  return []
}

export async function generateMetadata({
  params,
}: PhotoPageProps): Promise<Metadata> {
  const { photoId } = await params
  const { photo } = await loadPhotoRouteData(photoId)

  return createPageMetadata(photo.title)
}

export default async function PhotoPage({ params }: PhotoPageProps) {
  const { photoId } = await params
  const { photo, photos } = await loadPhotoRouteData(
    decodeEncodedPathSegment(photoId),
  )

  return <PhotoGallery photos={photos} initialPhotoSlug={photo.slug} />
}
