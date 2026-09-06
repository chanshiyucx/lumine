import { useLayoutEffect, type RefObject } from 'react'
import type { Swiper } from 'swiper'

export function useSwiperResize(swiperRef: RefObject<Swiper | null>) {
  useLayoutEffect(() => {
    const swiper = swiperRef.current
    if (!swiper) {
      return
    }

    const observer = new ResizeObserver(() => {
      if (
        swiper.destroyed ||
        (swiper.width === swiper.el.clientWidth &&
          swiper.height === swiper.el.clientHeight)
      ) {
        return
      }

      // Finish an in-flight slide before realigning it to the new viewport.
      if (swiper.animating) {
        swiper.transitionEnd(false)
      }

      // Update before paint; Swiper's default observer defers this to another frame.
      swiper.update()
    })
    observer.observe(swiper.el)

    return () => observer.disconnect()
  }, [swiperRef])
}
