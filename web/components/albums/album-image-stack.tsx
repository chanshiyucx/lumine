'use client'

import { useState } from 'react'
import { ThumbnailImage, type ThumbnailImagePhoto } from '@/components/photo'
import { cn } from '@/lib/style'

interface AlbumImageStackProps {
  photos: ThumbnailImagePhoto[]
}

const stackImageClassNames = [
  'z-30 shadow-lg',
  'z-20 -translate-x-1 -translate-y-1.5 -rotate-4 scale-[0.99] brightness-90 shadow-md group-hover:-rotate-6 group-hover:brightness-100 group-hover:shadow-lg',
  'z-10 translate-x-1 -translate-y-1 rotate-4 scale-[0.98] brightness-80 shadow-sm group-hover:rotate-7 group-hover:brightness-100 group-hover:shadow-lg',
]

export function AlbumImageStack({ photos }: AlbumImageStackProps) {
  const [canLoadBackImages, setCanLoadBackImages] = useState(false)

  function revealBackImages() {
    setCanLoadBackImages(true)
  }

  return (
    <div className="relative mb-4 aspect-3/2 w-full">
      {photos.map((photo, index) => {
        const isCover = index === 0

        return (
          <div
            key={photo.thumbnail.url}
            className={cn(
              'bg-surface absolute inset-0 origin-bottom overflow-hidden rounded-lg transition-[rotate,filter,box-shadow] duration-240 ease-out motion-reduce:transition-none',
              stackImageClassNames[index],
            )}
          >
            <ThumbnailImage
              photo={photo}
              fetchPriority={isCover ? 'high' : 'low'}
              loadImage={isCover || canLoadBackImages}
              loading="lazy"
              onError={isCover ? revealBackImages : undefined}
              onLoad={isCover ? revealBackImages : undefined}
            />
          </div>
        )
      })}
    </div>
  )
}
