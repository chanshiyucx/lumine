'use client'

import type { RenderComponentProps } from 'masonic'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
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
  onVisiblePhotosChange?: (photos: Photo[]) => void
}

const HEADER_HEIGHT = 48

function getPhotoKey(photo: Photo) {
  return photo.id
}

function arePhotoIdsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((id, index) => id === right[index])
}

export const MasonryGrid = memo(function MasonryGrid({
  photos,
  onOpen,
  onVisiblePhotosChange,
}: MasonryGridProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const lastVisiblePhotoIdsRef = useRef<string[] | null>(null)
  const masonryConfig = useMasonryConfig()

  const itemHeightEstimate = useMemo(() => {
    return getMasonryItemHeightEstimate(photos, masonryConfig.columnWidth)
  }, [masonryConfig.columnWidth, photos])

  const renderItem = useCallback(
    (props: RenderComponentProps<Photo>) => (
      <MasonryItem photo={props.data} index={props.index} onOpen={onOpen} />
    ),
    [onOpen],
  )

  const publishVisiblePhotos = useCallback(() => {
    const container = containerRef.current

    if (!container || !onVisiblePhotosChange) {
      return
    }

    const visiblePhotos = Array.from(
      container.querySelectorAll<HTMLElement>('[data-photo-index]'),
    )
      .filter((element) => {
        const rect = element.getBoundingClientRect()

        return rect.bottom > HEADER_HEIGHT && rect.top < window.innerHeight
      })
      .map((element) => photos[Number(element.dataset.photoIndex)])
      .filter((photo): photo is Photo => photo !== undefined)
    const visiblePhotoIds = visiblePhotos.map((photo) => photo.id)
    const previousVisiblePhotoIds = lastVisiblePhotoIdsRef.current

    if (
      previousVisiblePhotoIds &&
      arePhotoIdsEqual(previousVisiblePhotoIds, visiblePhotoIds)
    ) {
      return
    }

    lastVisiblePhotoIdsRef.current = visiblePhotoIds

    onVisiblePhotosChange(visiblePhotos)
  }, [onVisiblePhotosChange, photos])

  useEffect(() => {
    if (!onVisiblePhotosChange) {
      return
    }

    let frameId: number | null = null
    lastVisiblePhotoIdsRef.current = null

    const schedulePublishVisiblePhotos = () => {
      if (frameId !== null) {
        return
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null
        publishVisiblePhotos()
      })
    }

    schedulePublishVisiblePhotos()
    window.addEventListener('scroll', schedulePublishVisiblePhotos, {
      passive: true,
    })
    window.addEventListener('resize', schedulePublishVisiblePhotos)

    return () => {
      window.removeEventListener('scroll', schedulePublishVisiblePhotos)
      window.removeEventListener('resize', schedulePublishVisiblePhotos)

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [onVisiblePhotosChange, publishVisiblePhotos])

  return (
    <div ref={containerRef}>
      <Masonic<Photo>
        role="grid"
        aria-label="Photo Masonry"
        className="mt-12 w-full max-w-full"
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
    </div>
  )
})
