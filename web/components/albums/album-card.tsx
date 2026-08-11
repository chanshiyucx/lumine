import Link from 'next/link'
import { formatAlbumDateCompact, getAlbumPath, type Album } from '@/lib/albums'
import { AlbumImageStack, type AlbumCoverLoading } from './album-image-stack'

interface AlbumCardProps {
  album: Album
  coverLoading: AlbumCoverLoading
}

export function AlbumCard({ album, coverLoading }: AlbumCardProps) {
  const dateLabel = formatAlbumDateCompact(album.date)
  const photoCount = album.photos.length
  const photoCountLabel = `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`

  return (
    <Link
      href={getAlbumPath(album.key)}
      className="group block w-full max-w-80"
    >
      <AlbumImageStack photos={album.photos} coverLoading={coverLoading} />

      <div className="px-2">
        <h2 className="text-subtle group-hover:text-text truncate font-semibold transition-colors">
          {album.title}
        </h2>
        <p className="text-muted mt-1 truncate text-sm">
          {dateLabel} · {photoCountLabel}
        </p>
      </div>
    </Link>
  )
}
