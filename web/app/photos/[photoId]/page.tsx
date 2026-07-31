import type { Metadata } from 'next'
import { GalleryPage } from '@/components/gallery/gallery-page'
import { getPhotoCollection } from '@/lib/photo/collection'
import { siteConfig } from '@/lib/site-config'

interface PhotoPageProps {
  params: Promise<{ photoId: string }>
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
  const { photoId } = await params
  const photoCollection = await getPhotoCollection()
  const photo = photoCollection.photos.find(({ slug }) => slug === photoId)

  if (!photo) {
    return {}
  }

  const title = `${photo.title} | ${siteConfig.title}`

  return {
    title,
    description: siteConfig.description,
    openGraph: {
      title,
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
  const { photoId } = await params

  return <GalleryPage initialPhotoSlug={photoId} />
}
