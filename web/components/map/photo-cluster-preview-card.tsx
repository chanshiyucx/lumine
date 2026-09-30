import { CalendarLine } from '@mingcute/react/calendar'
import { CameraLine } from '@mingcute/react/camera'
import { MAP_PREVIEW_CAPACITY } from '@/lib/map-config'
import type { PhotoMapItem } from '@/lib/map-types'
import { getPhotoSummary } from '@/lib/photo/summary'
import { MapCoordinates } from './map-coordinates'
import { MapPreviewGrid } from './map-preview-grid'

export function PhotoClusterPreviewCard({
  items,
  location,
}: {
  items: readonly PhotoMapItem[]
  location: { lat: number; lng: number }
}) {
  const count = items.length
  const { dateLabel, cameraName } = getPhotoSummary(items)

  return (
    <section
      className="overflow-hidden"
      aria-label={`${count} photos at this location`}
    >
      <div className="p-4 pb-0">
        <MapPreviewGrid
          entries={items.slice(0, MAP_PREVIEW_CAPACITY).map((item) => ({
            key: item.key,
            label: item.label,
            ariaLabel: `Open photo ${item.label} in a new tab`,
            cover: item.covers[0],
          }))}
          count={count}
        />
      </div>
      <div className="text-subtle space-y-2 p-4 text-xs">
        <p className="flex items-center gap-2">
          <CalendarLine className="size-4 shrink-0" aria-hidden="true" />
          {dateLabel}
        </p>
        {cameraName && (
          <p className="flex items-center gap-2">
            <CameraLine className="size-4 shrink-0" aria-hidden="true" />
            {cameraName}
          </p>
        )}
        <MapCoordinates location={location} />
      </div>
    </section>
  )
}
