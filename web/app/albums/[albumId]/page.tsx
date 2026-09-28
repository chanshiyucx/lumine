import type { Metadata } from 'next'
import { PhotoGallery } from '@/components/gallery'
import { getAlbumCatalog } from '@/lib/album/catalog'
import { formatReadableDate } from '@/lib/date'
import { createPageMetadata } from '@/lib/page-metadata'
import { decodeEncodedPathSegment } from '@/lib/url-segments'
import { loadAlbumRouteData } from './_data'

type AlbumPageProps = PageProps<'/albums/[albumId]'>

export async function generateStaticParams() {
  const catalog = await getAlbumCatalog()

  return catalog.albums.map((album) => ({
    albumId: album.key,
  }))
}

export async function generateMetadata({
  params,
}: AlbumPageProps): Promise<Metadata> {
  const { albumId } = await params
  const album = await loadAlbumRouteData(albumId)

  return createPageMetadata(album.title)
}

export default async function AlbumPage({ params }: AlbumPageProps) {
  const { albumId } = await params
  const album = await loadAlbumRouteData(decodeEncodedPathSegment(albumId))

  return (
    <PhotoGallery
      photos={album.photos}
      fixedHeaderDetail={{
        date: formatReadableDate(album.date),
        location: album.title,
      }}
    />
  )
}
