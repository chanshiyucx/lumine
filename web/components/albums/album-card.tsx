import Link from 'next/link'
import { ThumbnailImage } from '@/components/photo'
import { getAlbumPath, type Album } from '@/lib/albums'
import { cn } from '@/lib/style'

interface AlbumCardProps {
  album: Album
}

const stackImageClassNames = [
  'z-30 shadow-lg',
  'z-20 -translate-x-1 -translate-y-1.5 -rotate-4 scale-[0.99] opacity-95 shadow-md group-hover:-rotate-6 group-hover:scale-[0.995] group-hover:opacity-100 group-hover:shadow-lg',
  'z-10 translate-x-1 -translate-y-1 rotate-4 scale-[0.98] opacity-85 shadow-sm group-hover:rotate-7 group-hover:scale-[0.985] group-hover:opacity-100 group-hover:shadow-lg',
]

const stackOverlayClassNames = ['', 'bg-black/10', 'bg-black/20']

function getAlbumDisplayInfo(album: Album) {
  const [location, date] = album.label.split(' · ')

  return {
    location: location || album.label,
    date,
  }
}

export function AlbumCard({ album }: AlbumCardProps) {
  const displayPhotos = album.photos.slice(0, 3)
  const { location, date } = getAlbumDisplayInfo(album)
  const photoCountLabel = `${album.photos.length} ${album.photos.length === 1 ? 'photo' : 'photos'}`

  return (
    <Link
      href={getAlbumPath(album.key)}
      className="group block w-full max-w-80"
    >
      <div className="relative mb-4 aspect-3/2 w-full">
        {displayPhotos.map((photo, index) => (
          <div
            key={photo.id}
            className={cn(
              'bg-surface absolute inset-0 origin-bottom overflow-hidden rounded-lg transition-[rotate,scale,opacity,box-shadow] duration-240 ease-out motion-reduce:transition-none',
              stackImageClassNames[index],
            )}
          >
            <ThumbnailImage
              photo={{
                title: photo.title,
                thumbHash: photo.thumbHash,
                thumbnail: {
                  url: photo.thumbnail.url,
                  width: photo.thumbnail.width,
                  height: photo.thumbnail.height,
                },
              }}
              decorative
              loading="lazy"
            />
            {index > 0 && (
              <div
                className={cn(
                  'absolute inset-0 transition-opacity duration-240 ease-out group-hover:opacity-0 motion-reduce:transition-none',
                  stackOverlayClassNames[index],
                )}
              />
            )}
          </div>
        ))}
      </div>

      <div className="px-2">
        <h3 className="text-subtle group-hover:text-text text-medium flex-1 truncate font-semibold transition-colors">
          {location}
        </h3>
        <p className="text-muted mt-1 flex gap-1 truncate text-sm">
          <span>{date}</span>
          <span> · </span>
          <span>{photoCountLabel}</span>
        </p>
      </div>
    </Link>
  )
}
