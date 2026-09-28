'use client'

import dynamic from 'next/dynamic'
import type { AlbumMapItem, PhotoMapItem } from '@/lib/map-items'
import { MapLoadingState } from './map-states'

interface PhotoMapLoaderProps {
  albumItems: AlbumMapItem[]
  photos: PhotoMapItem[]
}

export const PhotoMapLoader = dynamic<PhotoMapLoaderProps>(
  () => import('./photo-map').then((module) => module.PhotoMap),
  {
    ssr: false,
    loading: () => (
      <main className="h-svh">
        <MapLoadingState className="h-full" />
      </main>
    ),
  },
)
