// Private galleries publish their count for the shared header.
let currentPhotoCount: number | null = null
const photoCountListeners = new Set<() => void>()

export function getPublishedPhotoCount() {
  return currentPhotoCount
}

export function getPublishedPhotoCountOnServer() {
  return null
}

export function subscribePublishedPhotoCount(listener: () => void) {
  photoCountListeners.add(listener)

  return () => {
    photoCountListeners.delete(listener)
  }
}

export function publishPhotoCount(count: number | null) {
  if (currentPhotoCount === count) {
    return
  }

  currentPhotoCount = count

  photoCountListeners.forEach((listener) => {
    listener()
  })
}
