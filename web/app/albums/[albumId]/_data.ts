import 'server-only'
import { notFound } from 'next/navigation'
import { getAlbumCatalog } from '@/lib/album/catalog'

export async function loadAlbumRouteData(albumId: string) {
  const catalog = await getAlbumCatalog()
  const album = catalog.getByKey(albumId)

  if (!album) {
    notFound()
  }

  return album
}
