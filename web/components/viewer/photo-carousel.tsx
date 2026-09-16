import { useEffect, useRef, useState } from 'react'
import type { Swiper as SwiperInstance } from 'swiper'
import { A11y, Virtual } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'
import 'swiper/css'
import 'swiper/css/virtual'
import type { Photo } from '@/lib/photo'
import { useSwiperResize } from './hooks/use-swiper-resize'
import { ProgressivePhoto } from './progressive-photo'

interface PhotoCarouselProps {
  photos: Photo[]
  activeIndex: number
  isMobile: boolean
  isZoomed: boolean
  isSwipeDisabled: boolean
  isInteractionEnabled: boolean
  onActiveIndexChange: (index: number) => void
  onZoomStateChange: (isZoomed: boolean) => void
}

export function PhotoCarousel({
  photos,
  activeIndex,
  isMobile,
  isZoomed,
  isSwipeDisabled,
  isInteractionEnabled,
  onActiveIndexChange,
  onZoomStateChange,
}: PhotoCarouselProps) {
  const swiperRef = useRef<SwiperInstance | null>(null)
  const [initialPhotoId] = useState(photos[activeIndex]?.id ?? null)
  const allowTouchMove =
    isInteractionEnabled && isMobile && !isZoomed && !isSwipeDisabled

  useSwiperResize(swiperRef)

  useEffect(() => {
    const swiper = swiperRef.current
    if (swiper && swiper.activeIndex !== activeIndex) {
      swiper.slideTo(activeIndex, 300)
    }
  }, [activeIndex])

  useEffect(() => {
    if (swiperRef.current) {
      swiperRef.current.allowTouchMove = allowTouchMove
    }
  }, [allowTouchMove])

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
      resizeObserver={false}
      updateOnWindowResize={false}
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
              loadDelayMs={photo.id === initialPhotoId ? 0 : 150}
              shouldMountInteractiveImage={isInteractionEnabled}
              onZoomStateChange={isActive ? onZoomStateChange : undefined}
            />
          </SwiperSlide>
        )
      })}
    </Swiper>
  )
}
