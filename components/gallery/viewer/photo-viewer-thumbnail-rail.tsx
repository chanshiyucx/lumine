import type { MouseEvent, MutableRefObject, RefObject } from 'react'
import type { GalleryPhoto } from '@/lib/photos'
import { cn } from '@/lib/style'
import { PhotoThumbnailImage } from '../photo-thumbnail-image'

interface PhotoViewerThumbnailRailProps {
  photos: GalleryPhoto[]
  activeIndex: number
  hoverPreviewIndex: number | null
  loadedThumbnailUrls: Set<string>
  railShellRef: RefObject<HTMLDivElement | null>
  railViewportRef: RefObject<HTMLDivElement | null>
  thumbnailRefs: MutableRefObject<Array<HTMLButtonElement | null>>
  onSelect: (index: number) => void
  onThumbnailEnter: (
    index: number,
    event: MouseEvent<HTMLButtonElement>,
  ) => void
  onThumbnailMove: (index: number, event: MouseEvent<HTMLButtonElement>) => void
  onThumbnailLeave: () => void
  onThumbnailLoad: (thumbnailUrl: string) => void
}

export function PhotoViewerThumbnailRail({
  photos,
  activeIndex,
  hoverPreviewIndex,
  loadedThumbnailUrls,
  railShellRef,
  railViewportRef,
  thumbnailRefs,
  onSelect,
  onThumbnailEnter,
  onThumbnailMove,
  onThumbnailLeave,
  onThumbnailLoad,
}: PhotoViewerThumbnailRailProps) {
  return (
    <div
      ref={railShellRef}
      className="bg-base/88 relative h-[72px] w-full shrink-0 backdrop-blur-xl md:h-[84px]"
    >
      <div
        ref={railViewportRef}
        className="h-full overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Preview thumbnails"
      >
        <div className="flex min-w-max items-end">
          {photos.map((photo, index) => {
            const isActive = index === activeIndex
            const isHovered = hoverPreviewIndex === index
            const thumbnailHeight = 84
            const thumbnailWidth = Math.max(
              72,
              Math.round(thumbnailHeight * photo.aspectRatio),
            )
            const isThumbnailLoaded = loadedThumbnailUrls.has(
              photo.thumbnail.url,
            )

            return (
              <button
                key={photo.id}
                ref={(node) => {
                  thumbnailRefs.current[index] = node
                }}
                type="button"
                className={cn(
                  'group relative shrink-0 overflow-hidden transition-[filter,opacity] duration-300 ease-out focus:outline-none focus-visible:outline-none',
                  isActive
                    ? 'z-10 opacity-100 grayscale-0'
                    : isHovered
                      ? 'opacity-100 grayscale-0'
                      : 'opacity-72 grayscale hover:opacity-92',
                )}
                style={{
                  width: `${thumbnailWidth}px`,
                  height: `${thumbnailHeight}px`,
                }}
                onClick={() => onSelect(index)}
                onMouseEnter={(event) => onThumbnailEnter(index, event)}
                onMouseMove={(event) => onThumbnailMove(index, event)}
                onMouseLeave={onThumbnailLeave}
                aria-label={`Open ${photo.title}`}
                aria-current={isActive}
              >
                <PhotoThumbnailImage
                  photo={photo}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  blurClassName="scale-[1.04] blur-[2px]"
                  imageClassName={cn(
                    'absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ease-out',
                    isThumbnailLoaded ? 'opacity-100' : 'opacity-0',
                  )}
                  onLoad={() => onThumbnailLoad(photo.thumbnail.url)}
                />
                <div
                  className={cn(
                    'absolute inset-0 transition-colors duration-200',
                    isHovered || isActive ? 'bg-transparent' : 'bg-base/28',
                  )}
                />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
