'use client'

import dynamic from 'next/dynamic'
import type { AlbumMapItem } from './lib/album-map-data'
import { MapLoadingState } from './map-states'

interface AlbumMapLoaderProps {
  items: AlbumMapItem[]
}

export const AlbumMapLoader = dynamic<AlbumMapLoaderProps>(
  () => import('./album-map').then((module) => module.AlbumMap),
  {
    ssr: false,
    loading: () => (
      <main className="h-svh">
        <MapLoadingState className="h-full" />
      </main>
    ),
  },
)
