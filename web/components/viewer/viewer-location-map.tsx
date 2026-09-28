'use client'

import 'maplibre-gl/dist/maplibre-gl.css'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { MapRef } from 'react-map-gl/maplibre'
import { MAP_STYLE_URL } from '@/lib/map-config'
import type { PhotoLocation } from '@/lib/photo'

interface ViewerLocationMapProps {
  location?: PhotoLocation
  photoId: string
  isActive: boolean
}

const subscribeToHydration = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

const Map = dynamic(() => import('react-map-gl/maplibre'), { ssr: false })

export function ViewerLocationMap({
  location,
  photoId,
  isActive,
}: ViewerLocationMapProps) {
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  )
  const [initialLocation, setInitialLocation] = useState<PhotoLocation | null>(
    null,
  )
  const mapRef = useRef<MapRef>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const isMapActive = isActive && location !== undefined

  // Latch the first eligible location for this Viewer session. Hiding the panel
  // or switching to a photo without GPS must not unmount an existing map.
  if (isHydrated && initialLocation === null && isMapActive) {
    setInitialLocation(location)
  }

  useEffect(() => {
    const map = mapRef.current
    const container = containerRef.current
    if (!map || !container || !isActive || !isLoaded || !location) return

    map.resize()
    map.jumpTo({ center: [location.lng, location.lat], zoom: 15 })

    // Keep the map sized during panel transitions and breakpoint changes.
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(container)
    return () => observer.disconnect()
  }, [isActive, isLoaded, location])

  if (initialLocation === null) return null

  return (
    <div
      ref={containerRef}
      data-viewer-location-map
      data-map-status={isLoaded ? 'loaded' : 'loading'}
      className="relative h-40 overflow-hidden rounded-md"
      role="group"
      aria-label="Photo location map"
    >
      <Map
        ref={mapRef}
        initialViewState={{
          latitude: initialLocation.lat,
          longitude: initialLocation.lng,
          zoom: 15,
        }}
        mapStyle={MAP_STYLE_URL}
        interactive={false}
        attributionControl={false}
        onLoad={() => setIsLoaded(true)}
      />

      {isLoaded ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 grid size-3 -translate-1/2 place-items-center"
        >
          <span
            className="bg-love absolute inset-0 animate-ping rounded-full opacity-75 motion-reduce:hidden"
            style={{ animationPlayState: isMapActive ? 'running' : 'paused' }}
          />
          <span className="bg-love relative size-2 rounded-full ring-2 ring-white/80" />
        </div>
      ) : (
        <div
          className="bg-base/40 text-text/60 absolute inset-0 grid place-items-center text-xs backdrop-blur-sm"
          role="status"
        >
          Loading map…
        </div>
      )}

      <Link
        href={{ pathname: '/map', query: { photoId } }}
        target="_blank"
        rel="noopener noreferrer"
        prefetch={false}
        aria-label="View photo location on the map in a new tab"
        className="absolute inset-0 cursor-pointer rounded-md transition-colors duration-200 hover:bg-black/10 focus-visible:outline-offset-[-2px]"
      />
    </div>
  )
}
