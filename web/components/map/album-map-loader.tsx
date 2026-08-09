'use client'

import dynamic from 'next/dynamic'
import type { AlbumMapItem } from './lib/album-map-data'
import { MapLoadingState } from './map-loading-state'

const AlbumMap = dynamic(
  () => import('./album-map').then((module) => module.AlbumMap),
  {
    ssr: false,
    loading: () => (
      <main className="bg-base h-svh">
        <MapLoadingState className="h-full w-full" />
      </main>
    ),
  },
)

interface AlbumMapLoaderProps {
  items: AlbumMapItem[]
}

export function AlbumMapLoader({ items }: AlbumMapLoaderProps) {
  return <AlbumMap items={items} />
}
