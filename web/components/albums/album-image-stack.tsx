import { ServerThumbHashImage } from '@/components/image/server-thumbhash-image'
import {
  ThumbnailImage,
  type ImageLoading,
  type ThumbnailImagePhoto,
} from '@/components/image/thumbnail-image'
import { cn } from '@/lib/style'

interface AlbumImageStackProps {
  photos: readonly ThumbnailImagePhoto[]
  coverLoading: ImageLoading
}

const STACK_IMAGE_CLASS_NAMES = [
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
      {photos.slice(0, STACK_IMAGE_CLASS_NAMES.length).map((photo, index) => {
        const isCover = index === 0

        return (
          <div
            key={photo.thumbnail.url}
            className={cn(
              'bg-surface absolute inset-0 origin-bottom overflow-hidden rounded-lg transition-[rotate] duration-240 ease-out motion-reduce:transition-none',
              STACK_IMAGE_CLASS_NAMES[index],
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
