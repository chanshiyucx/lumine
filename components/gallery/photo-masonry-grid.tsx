'use client'

import { Masonry, type RenderComponentProps } from 'masonic'
import { memo, useCallback, useMemo, useRef } from 'react'
import type { GalleryPhoto } from '@/lib/photos'
import { useElementWidth } from './hooks/use-element-width'
import {
  getMasonryConfig,
  getMasonryItemHeightEstimate,
} from './lib/masonry-layout'
import { PhotoCard } from './photo-card'

const MASONRY_OVERSCAN = 2
const MASONRY_SCROLL_FPS = 12

export interface PhotoMasonryGridProps {
  photos: GalleryPhoto[]
  onOpen: (index: number) => void
}

interface MasonryPhotoItemProps extends RenderComponentProps<GalleryPhoto> {
  onOpen: (index: number) => void
}

const MasonryPhotoItem = memo(function MasonryPhotoItem({
  data,
  index,
  width,
  onOpen,
}: MasonryPhotoItemProps) {
  return <PhotoCard photo={data} index={index} width={width} onOpen={onOpen} />
})

export function PhotoMasonryGrid({ photos, onOpen }: PhotoMasonryGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const containerWidth = useElementWidth(containerRef)

  const masonryConfig = useMemo(() => {
    return getMasonryConfig(containerWidth)
  }, [containerWidth])

  const itemHeightEstimate = useMemo(() => {
    return getMasonryItemHeightEstimate(photos, masonryConfig.columnWidth)
  }, [masonryConfig.columnWidth, photos])

  const renderItem = useCallback(
    (props: RenderComponentProps<GalleryPhoto>) => (
      <MasonryPhotoItem {...props} onOpen={onOpen} />
    ),
    [onOpen],
  )

  const itemKey = useCallback((photo: GalleryPhoto) => {
    return photo.id
  }, [])

  return (
    <div ref={containerRef} className="w-full max-w-full">
      <Masonry<GalleryPhoto>
        role="grid"
        aria-label="Photo Masonry"
        className="w-full max-w-full"
        items={photos}
        render={renderItem}
        itemKey={itemKey}
        columnWidth={masonryConfig.columnWidth}
        columnGutter={masonryConfig.columnGutter}
        rowGutter={masonryConfig.rowGutter}
        maxColumnCount={masonryConfig.maxColumns}
        itemHeightEstimate={itemHeightEstimate}
        overscanBy={MASONRY_OVERSCAN}
        scrollFps={MASONRY_SCROLL_FPS}
        tabIndex={-1}
      />
    </div>
  )
}
