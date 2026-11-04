import { getAlbumCatalog } from '@/lib/album/catalog'
import { OG_IMAGE_CONTENT_TYPE, OG_IMAGE_SIZE } from '@/lib/og/config'
import { formatCount, renderMosaicOgImage } from '@/lib/og/mosaic'
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

  return renderMosaicOgImage({
    photos: candidatePhotos,
    stats: [
      formatCount(catalog.albums.length, 'album'),
      formatCount(photoCollection.photos.length, 'photo'),
    ],
    title: `${siteConfig.author} · ${siteConfig.name}`,
  })
}
