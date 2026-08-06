'use client'

import * as HoverCard from '@radix-ui/react-hover-card'
import { MapPinned } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { Marker, type MarkerInstance } from 'react-map-gl/maplibre'
import type { AlbumMapItem } from '@/lib/map/album-map-data'
import { AlbumMapCoverImage } from './album-map-cover'
import { AlbumPreviewCard } from './album-preview-card'
import { ClusterPreviewCard } from './cluster-preview-card'

interface MapMarkerProps {
  longitude: number
  latitude: number
  label: string
  onActivate?: () => void
  children: ReactNode
}

function MapMarker({
  longitude,
  latitude,
  label,
  onActivate,
  children,
}: MapMarkerProps) {
  const markerRef = useRef<MarkerInstance>(null)

  useEffect(() => {
    const element = markerRef.current?.getElement()
    if (!element) return

    element.setAttribute('aria-label', label)
    element.setAttribute('title', label)
    if (!onActivate) {
      element.setAttribute('role', 'img')
      element.removeAttribute('tabindex')
      return
    }

    element.setAttribute('role', 'button')
    element.setAttribute('tabindex', '0')

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return

      event.preventDefault()
      element.click()
    }

    element.addEventListener('keydown', handleKeyDown)
    return () => {
      element.removeEventListener('keydown', handleKeyDown)
      element.removeAttribute('tabindex')
    }
  }, [label, onActivate])

  return (
    <Marker
      ref={markerRef}
      longitude={longitude}
      latitude={latitude}
      anchor="center"
      onClick={
        onActivate
          ? (event) => {
              event.originalEvent.stopPropagation()
              onActivate()
            }
          : undefined
      }
    >
      {children}
    </Marker>
  )
}

export function AlbumMarker({ item }: { item: AlbumMapItem }) {
  const cover = item.covers[0]

  return (
    <MapMarker
      longitude={item.location.lng}
      latitude={item.location.lat}
      label={`${item.label} album location`}
    >
      <HoverCard.Root openDelay={350} closeDelay={120}>
        <HoverCard.Trigger asChild>
          <span
            className="group relative block size-11 cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white"
            aria-hidden
          >
            <span className="border-text/30 bg-overlay relative block size-11 overflow-hidden rounded-full border-2 shadow-xl transition-transform duration-200 group-hover:scale-110">
              {cover ? (
                <AlbumMapCoverImage cover={cover} alt="" />
              ) : (
                <MapPinned className="text-subtle absolute inset-0 m-auto size-4" />
              )}
              <span className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/15 to-black/15" />
            </span>
          </span>
        </HoverCard.Trigger>

        <HoverCard.Portal>
          <HoverCard.Content
            side="top"
            align="center"
            sideOffset={12}
            collisionPadding={16}
            className="z-50 w-80 outline-none"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <AlbumPreviewCard item={item} />
            <HoverCard.Arrow className="fill-base/95" width={14} height={7} />
          </HoverCard.Content>
        </HoverCard.Portal>
      </HoverCard.Root>
    </MapMarker>
  )
}

export function ClusterMarker({
  longitude,
  latitude,
  count,
  items,
  onExpand,
}: {
  longitude: number
  latitude: number
  count: number
  items: AlbumMapItem[]
  onExpand: () => void
}) {
  const size = Math.min(66, Math.max(50, 42 + Math.log2(count) * 7))
  const representativeCover = items[0]?.covers[0]

  return (
    <MapMarker
      longitude={longitude}
      latitude={latitude}
      label={`Zoom into ${count} albums`}
      onActivate={onExpand}
    >
      <HoverCard.Root openDelay={300} closeDelay={150}>
        <HoverCard.Trigger asChild>
          <span
            className="group relative block cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white"
            style={{ width: size, height: size }}
            aria-hidden
          >
            <span className="bg-iris/25 absolute -inset-1.5 animate-pulse rounded-full" />
            <span className="border-text/25 bg-overlay relative block size-full overflow-hidden rounded-full border-2 shadow-2xl transition-transform duration-200 group-hover:scale-105">
              {representativeCover && (
                <AlbumMapCoverImage
                  cover={representativeCover}
                  loading="eager"
                />
              )}
              <span className="from-base/25 to-iris/65 pointer-events-none absolute inset-0 bg-linear-to-br" />
              <span className="text-text pointer-events-none absolute inset-0 grid place-items-center text-sm font-bold drop-shadow-lg">
                {count}
              </span>
            </span>
          </span>
        </HoverCard.Trigger>

        <HoverCard.Portal>
          <HoverCard.Content
            side="top"
            align="center"
            sideOffset={12}
            collisionPadding={16}
            className="z-50 w-80 outline-none"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <ClusterPreviewCard count={count} items={items} />
            <HoverCard.Arrow className="fill-base/95" width={14} height={7} />
          </HoverCard.Content>
        </HoverCard.Portal>
      </HoverCard.Root>
    </MapMarker>
  )
}
