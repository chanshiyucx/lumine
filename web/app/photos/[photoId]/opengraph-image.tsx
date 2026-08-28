import { notFound } from 'next/navigation'
import { OG_IMAGE_CONTENT_TYPE, OG_IMAGE_SIZE } from '@/lib/og/config'
import { renderPhotoOgImage } from '@/lib/og/photo'
import { getPhotoCollection } from '@/lib/photo/collection'
import { siteConfig } from '@/lib/site-config'

interface PhotoOpenGraphImageProps {
  params: Promise<{ photoId: string }>
}

export const alt = `Photo by ${siteConfig.author}`
export const size = OG_IMAGE_SIZE
export const contentType = OG_IMAGE_CONTENT_TYPE
export const runtime = 'nodejs'

export default async function PhotoOpenGraphImage({
  params,
}: PhotoOpenGraphImageProps) {
  const [{ photoId }, photoCollection] = await Promise.all([
    params,
    getPhotoCollection(),
  ])
  const photo = photoCollection.photos.find(({ slug }) => slug === photoId)

  if (!photo) {
    notFound()
  }

  return renderPhotoOgImage(photo)
}
