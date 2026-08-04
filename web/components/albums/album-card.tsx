import Link from 'next/link'
import { ThumbnailImage } from '@/components/photo'
import { getAlbumPath, type Album } from '@/lib/albums'
import { cn } from '@/lib/style'

interface AlbumCardProps {
  album: Album
}

const stackImageClassNames = [
  'z-30 shadow-lg',
  'z-20 -translate-x-1 -translate-y-1.5 -rotate-4 scale-[0.99] brightness-90 shadow-md group-hover:-rotate-6 group-hover:brightness-100 group-hover:shadow-lg',
  'z-10 translate-x-1 -translate-y-1 rotate-4 scale-[0.98] brightness-80 shadow-sm group-hover:rotate-7 group-hover:brightness-100 group-hover:shadow-lg',
]

export function AlbumCard({ album }: AlbumCardProps) {
  const displayPhotos = album.photos.slice(0, 3)
  const [location, date] = album.label.split(' · ')
  const photoCount = album.photos.length
  const photoCountLabel = `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`

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
              'bg-surface absolute inset-0 origin-bottom overflow-hidden rounded-lg transition-[rotate,filter,box-shadow] duration-240 ease-out motion-reduce:transition-none',
              stackImageClassNames[index],
            )}
          >
            <ThumbnailImage
              photo={{
                thumbHash: photo.thumbHash,
                thumbnail: {
                  url: photo.thumbnail.url,
                  width: photo.thumbnail.width,
                  height: photo.thumbnail.height,
                },
              }}
            />
          </div>
        ))}
      </div>

      <div className="px-2">
        <h3 className="text-subtle group-hover:text-text truncate font-semibold transition-colors">
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
