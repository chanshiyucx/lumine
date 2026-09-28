import { ArrowRightLine } from '@mingcute/react/arrow-right'
import { CalendarLine } from '@mingcute/react/calendar'
import { CameraLine } from '@mingcute/react/camera'
import Link from 'next/link'
import type { MapItem } from '@/lib/album/map'
import { AlbumCoverLink } from './album-cover-link'
import { MapCoordinates } from './map-coordinates'
import { MapPreviewGrid } from './map-preview-grid'

export function AlbumPreviewCard({ item }: { item: MapItem }) {
  return (
    <section
      className="border-overlay bg-surface/95 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-2xl"
      aria-label={`${item.label} ${item.kind} preview`}
    >
      {item.kind === 'photo' ? (
        <div className="bg-overlay relative h-32">
          <AlbumCoverLink
            label={item.label}
            ariaLabel={`Open photo ${item.label} in a new tab`}
            cover={item.covers[0]}
            className="h-full"
          />
        </div>
      ) : (
        <div className="p-4 pb-0">
          <MapPreviewGrid
            entries={item.covers.map((cover) => ({
              key: cover.thumbnail.url,
              label: item.label,
              cover,
            }))}
            count={item.photoCount}
            moreHref={item.href}
          />
        </div>
      )}

      <div className="space-y-3 p-4">
        <Link
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-love flex items-center gap-2 transition-colors"
          aria-label={`Open ${item.label} in a new tab`}
        >
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
            {item.label}
          </h2>
          <ArrowRightLine
            className="text-subtle size-4 shrink-0"
            aria-hidden="true"
          />
        </Link>
        <div className="text-subtle space-y-2 text-xs">
          <p className="flex items-center gap-2">
            <CalendarLine className="size-4 shrink-0" aria-hidden="true" />
            {item.dateLabel}
          </p>
          {item.cameraName && (
            <p className="flex items-center gap-2">
              <CameraLine className="size-4 shrink-0" aria-hidden="true" />
              {item.cameraName}
            </p>
          )}
          <MapCoordinates location={item.location} />
        </div>
      </div>
    </section>
  )
}
