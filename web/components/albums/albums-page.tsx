import { getAlbums } from '@/lib/albums'
import { getPhotoCollection } from '@/lib/photo/collection'
import { AlbumCard } from './album-card'

export async function AlbumsPage() {
  const photoCollection = await getPhotoCollection()
  const albums = getAlbums(photoCollection.photos)

  return (
    <main className="px-6 pt-28 pb-20 sm:px-8 lg:px-10">
      <div
        className="mx-auto grid max-w-7xl justify-items-center gap-x-16 gap-y-16"
        style={{
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(100%, 16.25rem), 1fr))',
        }}
      >
        {albums.map((album) => (
          <AlbumCard key={album.key} album={album} />
        ))}
      </div>
    </main>
  )
}
