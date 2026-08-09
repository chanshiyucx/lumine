import 'maplibre-gl/dist/maplibre-gl.css'
import './map.css'

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        rel="preconnect"
        href="https://basemaps.cartocdn.com"
        crossOrigin="anonymous"
      />
      <link
        rel="preconnect"
        href="https://tiles.basemaps.cartocdn.com"
        crossOrigin="anonymous"
      />
      {children}
    </>
  )
}
