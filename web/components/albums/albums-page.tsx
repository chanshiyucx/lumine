import { getAlbumCatalog } from '@/lib/album-catalog'
import { AlbumCard } from './album-card'

const EAGER_COVER_COUNT = 4

export async function AlbumsPage() {
  const catalog = await getAlbumCatalog()

  return (
    <main className="px-6 pt-28 pb-20 sm:px-8 lg:px-10">
      <div
        className="mx-auto grid max-w-7xl justify-items-center gap-16"
        style={{
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(100%, 16.25rem), 1fr))',
        }}
      >
        {catalog.albums.map((album, index) => (
          <AlbumCard
            key={album.key}
            album={album}
            coverLoading={index < EAGER_COVER_COUNT ? 'eager' : 'lazy'}
          />
        ))}
      </div>
    </main>
  )
}
