import { formatReadableDate } from '@/lib/date'
import { OG_IMAGE_CONTENT_TYPE, OG_IMAGE_SIZE } from '@/lib/og/config'
import { findCameraLabel } from '@/lib/og/metadata'
import { renderMosaicOgImage, type StatItem } from '@/lib/og/mosaic'
import { siteConfig } from '@/lib/site-config'
import { loadAlbumRouteData } from './_data'

interface AlbumOpenGraphImageProps {
  params: Promise<{ albumKey: string }>
}

export const alt = `Photo album by ${siteConfig.author}`
export const size = OG_IMAGE_SIZE
export const contentType = OG_IMAGE_CONTENT_TYPE
export const runtime = 'nodejs'

export default async function AlbumOpenGraphImage({
  params,
}: AlbumOpenGraphImageProps) {
  const album = await loadAlbumRouteData(params)

  const cameraLabel = findCameraLabel(album.photos)
  const formattedDate = formatReadableDate(album.date)

  const stats: StatItem[] = [{ label: 'photos', value: album.photos.length }]

  if (cameraLabel) {
    stats.push({ label: 'cam', value: cameraLabel })
  }

  if (formattedDate) {
    stats.push({ label: 'date', value: formattedDate })
  }

  return renderMosaicOgImage({
    photos: album.photos,
    stats,
    tag: album.title,
    title: `${siteConfig.author} · ${siteConfig.name}`,
  })
}
