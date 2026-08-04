import { notFound } from 'next/navigation'
import { PhotoGallery } from '@/components/gallery'
import { getGalleryHeaderState } from '@/components/gallery/lib/gallery-header-state'
import { getAlbumByKey, getAlbums, normalizeAlbumKey } from '@/lib/albums'
import { getPhotoCollection } from '@/lib/photo/collection'

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
  const [{ albumKey }, photoCollection] = await Promise.all([
    params,
    getPhotoCollection(),
  ])
  const album = getAlbumByKey(
    photoCollection.photos,
    normalizeAlbumKey(albumKey),
  )

  if (!album) {
    notFound()
  }

  const [albumTitle] = album.label.split(' · ')

  return (
    <PhotoGallery
      photos={album.photos}
      fixedHeaderDetail={{
        ...getGalleryHeaderState(album.photos),
        location: albumTitle || album.label,
      }}
    />
  )
}
