export function formatCoordinates(
  location: { lat: number; lng: number },
  {
    fractionDigits = 6,
    compact = false,
  }: { fractionDigits?: number; compact?: boolean } = {},
) {
  const separator = compact ? '' : ' '

  return {
    latitude: `${Math.abs(location.lat).toFixed(fractionDigits)}°${separator}${location.lat < 0 ? 'S' : 'N'}`,
    longitude: `${Math.abs(location.lng).toFixed(fractionDigits)}°${separator}${location.lng < 0 ? 'W' : 'E'}`,
  }
}
