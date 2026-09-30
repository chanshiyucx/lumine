import { LocationLine } from '@mingcute/react/location'
import { Mountain2Line } from '@mingcute/react/mountain-2'
import { formatCoordinates } from '@/lib/coordinates'

export function MapCoordinates({
  location,
}: {
  location: { lat: number; lng: number; alt?: number }
}) {
  const { latitude, longitude } = formatCoordinates(location, {
    fractionDigits: 4,
    compact: true,
  })

  return (
    <>
      <p className="flex items-center gap-2">
        <LocationLine className="size-4 shrink-0" aria-hidden="true" />
        <span className="font-mono">
          {latitude}, {longitude}
        </span>
      </p>
      {location.alt != null && (
        <p className="flex items-center gap-2">
          <Mountain2Line className="size-4 shrink-0" aria-hidden="true" />
          <span className="font-mono">{location.alt.toFixed(1)}m</span>
        </p>
      )}
    </>
  )
}
