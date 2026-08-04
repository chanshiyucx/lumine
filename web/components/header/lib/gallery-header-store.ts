interface GalleryHeaderDetail {
  date?: string
  location?: string
  showDate: boolean
}

let currentGalleryHeaderDetail: GalleryHeaderDetail = {
  showDate: false,
}
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
