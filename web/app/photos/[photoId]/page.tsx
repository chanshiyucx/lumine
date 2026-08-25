import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PhotoGallery } from '@/components/gallery'
import { getPhotoCollection } from '@/lib/photo/collection'
import { getPhotoOgPath } from '@/lib/photo/share'
import { siteConfig } from '@/lib/site-config'

interface PhotoPageProps {
  params: Promise<{ photoId: string }>
}

async function getRequestedPhoto(params: PhotoPageProps['params']) {
  const [{ photoId }, photoCollection] = await Promise.all([
    params,
    getPhotoCollection(),
  ])
  const photo = photoCollection.photos.find(({ slug }) => slug === photoId)

  if (!photo) {
    notFound()
  }

  return { photo, photos: photoCollection.photos }
}

export async function generateStaticParams() {
  const photoCollection = await getPhotoCollection()

  return photoCollection.photos.map((photo) => ({
    photoId: photo.slug,
  }))
}

export async function generateMetadata({
  params,
}: PhotoPageProps): Promise<Metadata> {
  const { photo } = await getRequestedPhoto(params)
  const ogImageUrl = getPhotoOgPath(photo.slug)

  return {
    title: photo.title,
    openGraph: {
      title: photo.title,
      description: siteConfig.description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 628,
          alt: photo.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: photo.title,
      description: siteConfig.description,
      images: [ogImageUrl],
    },
  }
}

export default async function PhotoPage({ params }: PhotoPageProps) {
  const { photo, photos } = await getRequestedPhoto(params)

  return <PhotoGallery photos={photos} initialPhotoSlug={photo.slug} />
}
