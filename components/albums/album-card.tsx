/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { getAlbumPath, type Album } from '@/lib/albums'
import { cn } from '@/lib/style'

interface AlbumCardProps {
  album: Album
}

const stackImageClassNames = [
  'z-30 translate-x-0 translate-y-0 rotate-0 opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:rotate-0',
  'z-20 -translate-x-1.5 -translate-y-1 -rotate-3 opacity-90 group-hover:-translate-x-3 group-hover:-translate-y-2 group-hover:-rotate-6 group-hover:opacity-100',
  'z-10 translate-x-2 -translate-y-1.5 rotate-4 opacity-80 group-hover:translate-x-4 group-hover:-translate-y-3 group-hover:rotate-8 group-hover:opacity-100',
]

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
    <Link href={getAlbumPath(album.key)} className="group block">
      <div className="relative mb-4 h-48">
        {displayPhotos.map((photo, index) => (
          <div
            key={photo.id}
            className={cn(
              'bg-surface absolute inset-0 overflow-hidden rounded-lg shadow-lg transition-all duration-300 ease-out',
              stackImageClassNames[index],
            )}
          >
            <img
              src={photo.blurDataUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover"
            />
            <img
              src={photo.thumbnail.url}
              alt=""
              aria-hidden
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {index > 0 && (
              <div className="absolute inset-0 bg-black/20 transition-opacity duration-300 group-hover:opacity-0" />
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
