import type { Metadata } from 'next'
import { PhotoGallery } from '@/components/gallery'
import { getAlbumCatalog } from '@/lib/album-catalog'
import { formatReadableDate } from '@/lib/date'
import { siteConfig } from '@/lib/site-config'
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

  return {
    title: album.title,
    openGraph: {
      title: album.title,
      description: siteConfig.description,
    },
    twitter: {
      card: 'summary_large_image',
      title: album.title,
      description: siteConfig.description,
    },
  }
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
