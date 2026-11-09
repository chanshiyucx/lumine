'use client'

import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { MapLoadingState } from './map-states'
import type { PhotoMapProps } from './photo-map'

type PhotoMapLoaderProps = Omit<PhotoMapProps, 'photoId'>

function MapFallback() {
  return (
    <main className="h-svh">
      <MapLoadingState className="h-full" />
    </main>
  )
}

const LazyPhotoMap = dynamic<PhotoMapProps>(
  () => import('./photo-map').then((module) => module.PhotoMap),
  { ssr: false, loading: MapFallback },
)

function MapWithPhotoId(props: PhotoMapLoaderProps) {
  const photoId = useSearchParams().get('photoId') || undefined
  return <LazyPhotoMap key={photoId} {...props} photoId={photoId} />
}

export function PhotoMapLoader(props: PhotoMapLoaderProps) {
  return (
    <Suspense fallback={<MapFallback />}>
      <MapWithPhotoId {...props} />
    </Suspense>
  )
}
