import type { Metadata } from 'next'
import { PhotoGallery } from '@/components/gallery'
import { getAlbumCatalog } from '@/lib/album/catalog'
import { formatReadableDate } from '@/lib/date'
import { createPageMetadata } from '@/lib/page-metadata'
import { loadAlbumRouteData } from './_data'

type AlbumPageProps = PageProps<'/albums/[albumKey]'>

export async function generateStaticParams() {
  const catalog = await getAlbumCatalog()

  return catalog.albums.map((album) => ({
    albumKey: album.key,
  }))
}

export async function generateMetadata({
  params,
}: AlbumPageProps): Promise<Metadata> {
  const album = await loadAlbumRouteData(params)

  return createPageMetadata(album.title)
}

export default async function AlbumPage({ params }: AlbumPageProps) {
  const album = await loadAlbumRouteData(params)

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
