import { ThumbnailImage, type ThumbnailImagePhoto } from '@/components/photo'
import { ServerThumbHashImage } from '@/components/thumbhash/server'
import { cn } from '@/lib/style'

export type AlbumCoverLoading = 'eager' | 'lazy'

interface AlbumImageStackProps {
  photos: readonly ThumbnailImagePhoto[]
  coverLoading: AlbumCoverLoading
}

const stackImageClassNames = [
  'z-30 shadow-lg',
  'z-20 -translate-x-1 -translate-y-1.5 -rotate-4 scale-[0.99] shadow-md group-hover:-rotate-6',
  'z-10 translate-x-1 -translate-y-1 rotate-4 scale-[0.98] shadow-sm group-hover:rotate-7',
]

export function AlbumImageStack({
  photos,
  coverLoading,
}: AlbumImageStackProps) {
  return (
    <div className="relative mb-4 aspect-3/2">
      {photos.slice(0, stackImageClassNames.length).map((photo, index) => {
        const isCover = index === 0

        return (
          <div
            key={photo.thumbnail.url}
            className={cn(
              'bg-surface absolute inset-0 origin-bottom overflow-hidden rounded-lg transition-[rotate] duration-240 ease-out motion-reduce:transition-none',
              stackImageClassNames[index],
            )}
          >
            {isCover ? (
              <ThumbnailImage photo={photo} loading={coverLoading} />
            ) : (
              <ServerThumbHashImage
                thumbHash={photo.thumbHash}
                className="object-cover"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
