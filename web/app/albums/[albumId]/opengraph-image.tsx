import { formatReadableDate } from '@/lib/date'
import { OG_IMAGE_CONTENT_TYPE, OG_IMAGE_SIZE } from '@/lib/og/config'
import { formatCount, renderMosaicOgImage } from '@/lib/og/mosaic'
import { siteConfig } from '@/lib/site-config'
import { loadAlbumRouteData } from './_data'

interface AlbumOpenGraphImageProps {
  params: Promise<{ albumId: string }>
}

export const alt = `Photo album by ${siteConfig.author}`
export const size = OG_IMAGE_SIZE
export const contentType = OG_IMAGE_CONTENT_TYPE
export const runtime = 'nodejs'

export default async function AlbumOpenGraphImage({
  params,
}: AlbumOpenGraphImageProps) {
  const { albumId } = await params
  const album = await loadAlbumRouteData(albumId)

  return renderMosaicOgImage({
    detail: formatReadableDate(album.date),
    photos: album.photos,
    stats: [formatCount(album.photos.length, 'photo')],
    title: album.title,
  })
}
