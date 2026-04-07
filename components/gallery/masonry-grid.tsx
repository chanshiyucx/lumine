'use client'

import type { RenderComponentProps } from 'masonic'
import { memo, useCallback, useMemo } from 'react'
import { useViewportSize } from '@/hooks/use-viewport-size'
import type { Photo } from '@/lib/photos'
import {
  getMasonryConfig,
  getMasonryItemHeightEstimate,
} from './lib/masonry-layout'
import { Masonic } from './masonic'
import { MasonryItem } from './masonry-item'

const MASONRY_OVERSCAN = 2
const MASONRY_SCROLL_FPS = 12

export interface MasonryGridProps {
  photos: Photo[]
  onOpen: (index: number) => void
}

interface MasonryPhotoItemProps extends RenderComponentProps<Photo> {
  onOpen: (index: number) => void
}

const MasonryPhotoItem = memo(function MasonryPhotoItem({
  data,
  index,
  width,
  onOpen,
}: MasonryPhotoItemProps) {
  return (
    <MasonryItem photo={data} index={index} width={width} onOpen={onOpen} />
  )
})

export function MasonryGrid({ photos, onOpen }: MasonryGridProps) {
  const { width: viewportWidth } = useViewportSize()

  const masonryConfig = useMemo(() => {
    return getMasonryConfig(viewportWidth)
  }, [viewportWidth])

  const itemHeightEstimate = useMemo(() => {
    return getMasonryItemHeightEstimate(photos, masonryConfig.columnWidth)
  }, [masonryConfig.columnWidth, photos])

  const renderItem = useCallback(
    (props: RenderComponentProps<Photo>) => (
      <MasonryPhotoItem {...props} onOpen={onOpen} />
    ),
    [onOpen],
  )

  const itemKey = useCallback((photo: Photo) => {
    return photo.id
  }, [])

  return (
    <Masonic<Photo>
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
  )
}
