'use client'

import dynamic from 'next/dynamic'
import type { AlbumMapItem } from './lib/album-map-data'

const AlbumMap = dynamic(
  () => import('./album-map').then((module) => module.AlbumMap),
  {
    ssr: false,
    loading: () => <MapLoadingState />,
  },
)

interface AlbumMapLoaderProps {
  items: AlbumMapItem[]
}

function MapLoadingState() {
  return (
    <main className="bg-base flex h-svh items-center justify-center">
      <div className="text-center">
        <div className="bg-overlay mx-auto mb-4 size-10 animate-pulse rounded-full" />
        <p className="text-subtle text-sm">Preparing the map…</p>
      </div>
    </main>
  )
}

export function AlbumMapLoader({ items }: AlbumMapLoaderProps) {
  return <AlbumMap items={items} />
}
