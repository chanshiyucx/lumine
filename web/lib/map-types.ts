export interface MapLocation {
  lat: number
  lng: number
}

export interface MapCover {
  href: string
  thumbHash: string
  thumbnail: {
    url: string
    width: number
    height: number
  }
}

interface MapItemBase {
  key: string
  href: string
  label: string
  cameraName: string | null
  location: MapLocation
  covers: [MapCover, ...MapCover[]]
}

export interface AlbumMapItem extends MapItemBase {
  kind: 'album'
  photoCount: number
  dateLabel: string
}

export interface PhotoMapItem extends MapItemBase {
  kind: 'photo'
  takenAt: string
  captureTime: { date: string }
  location: MapLocation & { alt?: number }
}

export type MapItem = AlbumMapItem | PhotoMapItem
