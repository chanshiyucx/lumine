import { LocationLine } from '@mingcute/react/location'

export function MapCoordinates({
  location,
}: {
  location: { lat: number; lng: number }
}) {
  return (
    <p className="flex items-center gap-2">
      <LocationLine className="size-4 shrink-0" aria-hidden="true" />
      <span className="font-mono">
        {Math.abs(location.lat).toFixed(4)}°{location.lat < 0 ? 'S' : 'N'},{' '}
        {Math.abs(location.lng).toFixed(4)}°{location.lng < 0 ? 'W' : 'E'}
      </span>
    </p>
  )
}
