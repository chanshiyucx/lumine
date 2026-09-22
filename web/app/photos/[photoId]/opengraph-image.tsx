import { OG_IMAGE_CONTENT_TYPE, OG_IMAGE_SIZE } from '@/lib/og/config'
import { renderPhotoOgImage } from '@/lib/og/photo'
import { siteConfig } from '@/lib/site-config'
import { loadPhotoRouteData } from './_data'

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
  const { photo } = await loadPhotoRouteData(params)

  return renderPhotoOgImage(photo)
}
