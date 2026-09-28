import { CalendarLine } from '@mingcute/react/calendar'
import { CameraLine } from '@mingcute/react/camera'
import type { MapItem } from '@/lib/album/map'
import { MAP_PREVIEW_CAPACITY } from '@/lib/map-config'
import { getMapPhotoSummary } from '@/lib/map-photo-summary'
import { MapCoordinates } from './map-coordinates'
import { MapPreviewGrid } from './map-preview-grid'

export function PhotoClusterPreviewCard({
  items,
  count,
  location,
}: {
  items: MapItem[]
  count: number
  location: { lat: number; lng: number }
}) {
  const photos = items.filter((item) => item.kind === 'photo')
  const [firstPhoto, ...remainingPhotos] = photos
  const { dateLabel, cameraName } = getMapPhotoSummary(
    firstPhoto,
    remainingPhotos,
  )

  return (
    <section
      className="border-overlay bg-surface/95 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-2xl"
      aria-label={`${count} photos at this location`}
    >
      <div className="p-4 pb-0">
        <MapPreviewGrid
          entries={photos.slice(0, MAP_PREVIEW_CAPACITY).map((item) => ({
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
