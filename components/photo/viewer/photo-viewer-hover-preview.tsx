'use client'

import type { GalleryPhoto } from '@/lib/photos'
import { cn } from '@/lib/style'
import type { HoverPreviewState } from '../hooks/use-hover-preview'
import { PhotoThumbnailImage } from '../photo-thumbnail-image'

interface PhotoViewerHoverPreviewProps {
  photo: GalleryPhoto
  preview: HoverPreviewState
  isImageLoaded: boolean
  onThumbnailLoad: (thumbnailUrl: string) => void
}

export function PhotoViewerHoverPreview({
  photo,
  preview,
  isImageLoaded,
  onThumbnailLoad,
}: PhotoViewerHoverPreviewProps) {
  return (
    <div
      className="border-subtle/18 bg-base pointer-events-none absolute z-[90] hidden origin-bottom overflow-hidden border shadow-2xl motion-safe:[animation:viewer-hover-preview_220ms_cubic-bezier(0.16,1,0.3,1)_both] md:block"
      style={{
        left: preview.left,
        top: preview.top,
        width: preview.width,
        boxShadow:
          '0 24px 80px color-mix(in oklab, var(--color-base) 72%, transparent)',
      }}
    >
      <div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: `${photo.thumbnail.width} / ${photo.thumbnail.height}`,
        }}
      >
        <PhotoThumbnailImage
          photo={photo}
          draggable={false}
          blurClassName="scale-[1.04] blur-sm"
          imageClassName={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ease-out',
            isImageLoaded ? 'opacity-100' : 'opacity-0',
          )}
          onLoad={() => onThumbnailLoad(photo.thumbnail.url)}
        />
        <div className="from-base/80 absolute inset-x-0 bottom-0 bg-linear-to-t to-transparent px-4 py-3">
          <p className="text-text/96 truncate text-sm">{photo.title}</p>
        </div>
      </div>
    </div>
  )
}
