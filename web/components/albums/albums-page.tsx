import type { Album } from '@/lib/album'
import { getAlbumCatalog } from '@/lib/album/catalog'
import { cn } from '@/lib/style'
import { AlbumCard } from './album-card'

const EAGER_COVER_COUNT = 4

interface TimelineEntry {
  album: Album
  index: number
}

interface AlbumYear {
  year: string
  entries: TimelineEntry[]
}

// Expects albums already sorted by date, as the catalog returns them.
function groupAlbumsByYear(albums: readonly Album[]) {
  const years: AlbumYear[] = []

  albums.forEach((album, index) => {
    const year = album.date.slice(0, 4)
    const last = years.at(-1)
    const entry = { album, index }

    if (last?.year === year) {
      last.entries.push(entry)
    } else {
      years.push({ year, entries: [entry] })
    }
  })

  return years
}

export async function AlbumsPage() {
  const catalog = await getAlbumCatalog()
  const years = groupAlbumsByYear(catalog.albums)
  const lastIndex = catalog.albums.length - 1

  return (
    <main className="px-6 pt-36 pb-20 sm:px-8 lg:px-10">
      <div className="relative mx-auto max-w-92 md:max-w-5xl">
        <div
          aria-hidden
          className="bg-overlay absolute top-4 bottom-0 left-1.75 w-0.5 md:top-0 md:left-1/2 md:-ml-px"
        />

        {years.map(({ year, entries }) => (
          <section key={year} className="relative not-first-of-type:mt-16">
            <h2 className="mb-8 flex items-center gap-3 md:mb-16 md:justify-center">
              <span
                aria-hidden
                className="bg-muted size-4 shrink-0 rounded-full md:hidden"
              />
              <span className="md:bg-surface md:border-overlay text-text text-2xl font-bold tracking-tight md:rounded-full md:border md:px-6 md:py-2.5 md:text-3xl">
                {year}
              </span>
            </h2>

            <ol>
              {entries.map(({ album, index }) => {
                const isLeft = index % 2 === 0

                return (
                  <li
                    key={album.key}
                    className="@container relative pl-12 [--marker-y:calc(min(20rem,100cqw)/3)] not-first:mt-16 md:grid md:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)] md:pl-0 md:[--marker-y:calc(min(20rem,(100cqw_-_8rem)/2)/3)] md:not-first:-mt-20"
                  >
                    {/* --marker-y is the cover's vertical center: a 3:2 cover at most 20rem wide. */}
                    <span
                      aria-hidden
                      className="border-muted bg-base absolute top-(--marker-y) left-2 z-10 size-3.5 -translate-1/2 rounded-full border-3 md:left-1/2"
                    />
                    <span
                      aria-hidden
                      className={cn(
                        'bg-overlay absolute top-(--marker-y) left-4 h-px w-6 md:w-14',
                        isLeft
                          ? 'md:right-[calc(50%+7px)] md:left-auto'
                          : 'md:left-[calc(50%+7px)]',
                      )}
                    />
                    {index === lastIndex && (
                      // Hides the spine below the final marker.
                      <span
                        aria-hidden
                        className="bg-base absolute top-(--marker-y) bottom-0 left-1.75 w-0.5 md:left-1/2 md:-ml-px"
                      />
                    )}
                    <div
                      className={cn(
                        'flex md:row-start-1',
                        isLeft
                          ? 'md:col-start-1 md:justify-end'
                          : 'md:col-start-3',
                      )}
                    >
                      <AlbumCard
                        album={album}
                        coverLoading={
                          index < EAGER_COVER_COUNT ? 'eager' : 'lazy'
                        }
                      />
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        ))}
      </div>
    </main>
  )
}
