import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PhotoGallery } from '@/components/gallery'
import { getAlbumCatalog } from '@/lib/album-catalog'
import { formatReadableDate } from '@/lib/date'
import { siteConfig } from '@/lib/site-config'

interface AlbumPageProps {
  params: Promise<{ albumKey: string }>
}

async function getRequestedAlbum(params: AlbumPageProps['params']) {
  const [{ albumKey }, catalog] = await Promise.all([params, getAlbumCatalog()])
  const album = catalog.getByKey(albumKey)

  if (!album) {
    notFound()
  }

  return album
}

export async function generateStaticParams() {
  const catalog = await getAlbumCatalog()

  return catalog.albums.map((album) => ({
    albumKey: album.key,
  }))
}

export async function generateMetadata({
  params,
}: AlbumPageProps): Promise<Metadata> {
  const album = await getRequestedAlbum(params)

  const cover = album.photos[0]

  return {
    title: album.title,
    openGraph: {
      title: album.title,
      description: siteConfig.description,
      images: [
        {
          url: cover.thumbnail.url,
          width: cover.thumbnail.width,
          height: cover.thumbnail.height,
          alt: album.title,
        },
      ],
    },
  }
}

export default async function AlbumPage({ params }: AlbumPageProps) {
  const album = await getRequestedAlbum(params)

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
