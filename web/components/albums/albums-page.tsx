import { getAlbums } from '@/lib/albums'
import { getPhotoCollection } from '@/lib/photo-collection'
import { AlbumCard } from './album-card'

export async function AlbumsPage() {
  const photoCollection = await getPhotoCollection()
  const albums = getAlbums(photoCollection.photos)

  return (
    <main className="px-6 pt-28 pb-20 sm:px-8 lg:px-10">
      <section className="mx-auto max-w-7xl">
        <div className="mb-16 flex flex-col items-center text-center">
          <h1 className="mt-3 text-5xl leading-none font-black tracking-normal text-balance sm:text-7xl">
            Albums
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-x-12 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {albums.map((album) => (
            <AlbumCard key={album.key} album={album} />
          ))}
        </div>
      </section>
    </main>
  )
}
