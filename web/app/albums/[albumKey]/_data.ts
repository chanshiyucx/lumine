import 'server-only'
import { notFound } from 'next/navigation'
import { getAlbumCatalog } from '@/lib/album-catalog'

export async function loadAlbumRouteData(
  params: PageProps<'/albums/[albumKey]'>['params'],
) {
  const [{ albumKey }, catalog] = await Promise.all([params, getAlbumCatalog()])
  const album = catalog.getByKey(albumKey)

  if (!album) {
    notFound()
  }

  return album
}
