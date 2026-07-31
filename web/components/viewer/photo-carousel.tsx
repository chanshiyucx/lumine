import { useCallback, useEffect, useRef, useState } from 'react'
import type { Swiper as SwiperInstance } from 'swiper'
import { A11y, Virtual } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'
import type { Photo } from '@/lib/photo'
import { ProgressivePhoto } from './progressive-photo'

interface PhotoCarouselProps {
  photos: Photo[]
  activeIndex: number
  isMobile: boolean
  isSwipeDisabled: boolean
  onActiveIndexChange: (index: number) => void
}

interface ZoomState {
  photoId: string | null
  isZoomed: boolean
}

export function PhotoCarousel({
  photos,
  activeIndex,
  isMobile,
  isSwipeDisabled,
  onActiveIndexChange,
}: PhotoCarouselProps) {
  const swiperRef = useRef<SwiperInstance | null>(null)
  const activePhotoId = photos[activeIndex]?.id ?? null
  const [zoomState, setZoomState] = useState<ZoomState>({
    photoId: activePhotoId,
    isZoomed: false,
  })
  const isImageZoomed =
    zoomState.photoId === activePhotoId && zoomState.isZoomed
  const allowTouchMove = isMobile && !isImageZoomed && !isSwipeDisabled

  useEffect(() => {
    const swiper = swiperRef.current
    if (swiper && swiper.activeIndex !== activeIndex) {
      swiper.slideTo(activeIndex, isMobile ? 300 : 0)
    }
  }, [activeIndex, isMobile])

  useEffect(() => {
    if (swiperRef.current) {
      swiperRef.current.allowTouchMove = allowTouchMove
    }
  }, [allowTouchMove])

  const handleZoomStateChange = useCallback(
    (isZoomed: boolean) => {
      setZoomState((current) => {
        if (
          current.photoId === activePhotoId &&
          current.isZoomed === isZoomed
        ) {
          return current
        }

        return {
          photoId: activePhotoId,
          isZoomed,
        }
      })
    },
    [activePhotoId],
  )

  return (
    <Swiper
      modules={[A11y, Virtual]}
      className="size-full"
      initialSlide={activeIndex}
      slidesPerView={1}
      speed={300}
      threshold={10}
      simulateTouch={isMobile}
      allowTouchMove={allowTouchMove}
      resistanceRatio={0.65}
      preventInteractionOnTransition
      virtual
      a11y={{
        enabled: true,
        containerMessage: 'Photo viewer',
        itemRoleDescriptionMessage: 'Photo slide',
      }}
      onSwiper={(swiper) => {
        swiperRef.current = swiper
        swiper.allowTouchMove = allowTouchMove
      }}
      onSlideChange={(swiper) => {
        if (swiper.activeIndex !== activeIndex) {
          onActiveIndexChange(swiper.activeIndex)
        }
      }}
    >
      {photos.map((photo, index) => {
        const isActive = index === activeIndex

        return (
          <SwiperSlide
            key={photo.id}
            virtualIndex={index}
            aria-label={`${index + 1} / ${photos.length}: ${photo.title}`}
          >
            <ProgressivePhoto
              key={photo.original.url}
              photo={photo}
              isActive={isActive}
              onZoomStateChange={isActive ? handleZoomStateChange : undefined}
            />
          </SwiperSlide>
        )
      })}
    </Swiper>
  )
}
