import { getAlbumCatalog } from '@/lib/album-catalog'
import { OG_IMAGE_CONTENT_TYPE, OG_IMAGE_SIZE } from '@/lib/og/config'
import { formatCameraLabel } from '@/lib/og/metadata'
import { renderMosaicOgImage, type StatItem } from '@/lib/og/mosaic'
import { getPhotoCollection } from '@/lib/photo/collection'
import { siteConfig } from '@/lib/site-config'

export const alt = `${siteConfig.title} — ${siteConfig.description}`
export const size = OG_IMAGE_SIZE
export const contentType = OG_IMAGE_CONTENT_TYPE
export const runtime = 'nodejs'

export default async function OpenGraphImage() {
  const [photoCollection, catalog] = await Promise.all([
    getPhotoCollection(),
    getAlbumCatalog(),
  ])

  const albumCovers = catalog.albums
    .slice(0, 6)
    .map((album) => album.photos[0])
    .filter(Boolean)

  const candidatePhotos =
    albumCovers.length >= 6 ? albumCovers : photoCollection.photos.slice(0, 6)

  const mainCamera = photoCollection.photos
    .map(formatCameraLabel)
    .find((label) => label !== null)

  const stats: StatItem[] = [
    { label: 'photos', value: photoCollection.photos.length },
    { label: 'albums', value: catalog.albums.length },
  ]

  if (mainCamera) {
    stats.push({ label: 'cam', value: mainCamera })
  }

  return renderMosaicOgImage({
    description: siteConfig.description,
    photos: candidatePhotos,
    stats,
    title: `${siteConfig.author} · ${siteConfig.name}`,
  })
}
