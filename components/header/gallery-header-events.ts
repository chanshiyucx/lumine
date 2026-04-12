export interface GalleryHeaderDetail {
  dateRange?: string
  location?: string
  showDateRange: boolean
}

const defaultGalleryHeaderDetail: GalleryHeaderDetail = {
  showDateRange: false,
}

let currentGalleryHeaderDetail = defaultGalleryHeaderDetail
const galleryHeaderDetailListeners = new Set<() => void>()

export function getGalleryHeaderDetail() {
  return currentGalleryHeaderDetail
}

export function subscribeGalleryHeaderDetail(listener: () => void) {
  galleryHeaderDetailListeners.add(listener)

  return () => {
    galleryHeaderDetailListeners.delete(listener)
  }
}

export function publishGalleryHeaderDetail(detail: GalleryHeaderDetail) {
  currentGalleryHeaderDetail = detail

  galleryHeaderDetailListeners.forEach((listener) => {
    listener()
  })
}
