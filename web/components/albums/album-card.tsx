import Link from 'next/link'
import { getAlbumPath, type Album } from '@/lib/albums'
import { AlbumImageStack } from './album-image-stack'

interface AlbumCardProps {
  album: Album
}

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
      <AlbumImageStack
        photos={displayPhotos.map((photo) => ({
          thumbHash: photo.thumbHash,
          thumbnail: {
            url: photo.thumbnail.url,
            width: photo.thumbnail.width,
            height: photo.thumbnail.height,
          },
        }))}
      />

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
