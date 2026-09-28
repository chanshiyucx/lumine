import Link from 'next/link'
import type { Album } from '@/lib/album'
import { getPhotoSummary } from '@/lib/photo/summary'
import { getAlbumPath } from '@/lib/route-paths'
import { AlbumImageStack, type AlbumCoverLoading } from './album-image-stack'

interface AlbumCardProps {
  album: Album
  coverLoading: AlbumCoverLoading
}

export function AlbumCard({ album, coverLoading }: AlbumCardProps) {
  const { dateLabel } = getPhotoSummary(album.photos)

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
        <p className="text-muted mt-1 text-sm">{dateLabel}</p>
      </div>
    </Link>
  )
}
