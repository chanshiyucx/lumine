'use client'

import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import type { AlbumMapItem, PhotoMapItem } from '@/lib/map-items'
import { MapLoadingState } from './map-states'

interface PhotoMapLoaderProps {
  albumItems: AlbumMapItem[]
  photos: PhotoMapItem[]
}

function MapFallback() {
  return (
    <main className="h-svh">
      <MapLoadingState className="h-full" />
    </main>
  )
}

const Map = dynamic<PhotoMapLoaderProps & { photoId?: string }>(
  () => import('./photo-map').then((module) => module.PhotoMap),
  { ssr: false, loading: MapFallback },
)

function MapWithPhotoId(props: PhotoMapLoaderProps) {
  const photoId = useSearchParams().get('photoId') || undefined
  return <Map key={photoId} {...props} photoId={photoId} />
}

export function PhotoMapLoader(props: PhotoMapLoaderProps) {
  return (
    <Suspense fallback={<MapFallback />}>
      <MapWithPhotoId {...props} />
    </Suspense>
  )
}
