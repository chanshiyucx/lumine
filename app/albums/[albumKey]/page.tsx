import { notFound } from 'next/navigation'
import { Masonry } from '@/components/gallery/masonry'
import {
  getAlbumByKey,
  getAlbumPath,
  getAlbums,
  normalizeAlbumKey,
} from '@/lib/albums'
import { getPhotoCollection } from '@/lib/photo-collection'

export async function generateStaticParams() {
  const photoCollection = await getPhotoCollection()

  return getAlbums(photoCollection.photos).map((album) => ({
    albumKey: album.key,
  }))
}

export default async function AlbumPage({
  params,
}: {
  params: Promise<{ albumKey: string }>
}) {
  const { albumKey } = await params
  const photoCollection = await getPhotoCollection()
  const album = getAlbumByKey(
    photoCollection.photos,
    normalizeAlbumKey(albumKey),
  )

  if (!album) {
    notFound()
  }

  return <Masonry photos={album.photos} basePath={getAlbumPath(album.key)} />
}
