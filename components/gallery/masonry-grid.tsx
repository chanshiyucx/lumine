'use client'

import type { RenderComponentProps } from 'masonic'
import { useCallback, useMemo } from 'react'
import type { Photo } from '@/lib/photos'
import {
  getMasonryItemHeightEstimate,
  useMasonryConfig,
} from './lib/masonry-layout'
import { Masonic } from './masonic'
import { MasonryItem } from './masonry-item'

const MASONRY_OVERSCAN = 2
const MASONRY_SCROLL_FPS = 12

export interface MasonryGridProps {
  photos: Photo[]
  onOpen: (index: number) => void
}

function getPhotoKey(photo: Photo) {
  return photo.id
}

export function MasonryGrid({ photos, onOpen }: MasonryGridProps) {
  const masonryConfig = useMasonryConfig()

  const itemHeightEstimate = useMemo(() => {
    return getMasonryItemHeightEstimate(photos, masonryConfig.columnWidth)
  }, [masonryConfig.columnWidth, photos])

  const renderItem = useCallback(
    (props: RenderComponentProps<Photo>) => (
      <MasonryItem
        photo={props.data}
        index={props.index}
        width={props.width}
        onOpen={onOpen}
      />
    ),
    [onOpen],
  )

  return (
    <Masonic<Photo>
      role="grid"
      aria-label="Photo Masonry"
      className="w-full max-w-full"
      items={photos}
      render={renderItem}
      itemKey={getPhotoKey}
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
