import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PhotoGallery } from '@/components/gallery'
import { getPhotoCollection } from '@/lib/photo/collection'
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

  return {
    title: photo.title,
    openGraph: {
      title: photo.title,
      description: siteConfig.description,
      images: [
        {
          url: photo.thumbnail.url,
          width: photo.thumbnail.width,
          height: photo.thumbnail.height,
          alt: photo.title,
        },
      ],
    },
  }
}

export default async function PhotoPage({ params }: PhotoPageProps) {
  const { photo, photos } = await getRequestedPhoto(params)

  return <PhotoGallery photos={photos} initialPhotoSlug={photo.slug} />
}
