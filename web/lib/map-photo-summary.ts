export interface MapPhotoCapture {
  takenAt: string
  dateLabel: string
  cameraName: string | null
}

export function getMapPhotoSummary(
  first: MapPhotoCapture,
  remaining: readonly MapPhotoCapture[],
) {
  let earliest = first
  let latest = first
  let earliestTime = Date.parse(first.takenAt)
  let latestTime = earliestTime
  let cameraName = first.cameraName

  for (const photo of remaining) {
    const time = Date.parse(photo.takenAt)
    if (time < earliestTime) {
      earliest = photo
      earliestTime = time
    }
    if (time > latestTime) {
      latest = photo
      latestTime = time
    }
    if (photo.cameraName !== cameraName) cameraName = null
  }

  return {
    dateLabel:
      earliest.dateLabel === latest.dateLabel
        ? earliest.dateLabel
        : `${earliest.dateLabel} - ${latest.dateLabel}`,
    cameraName,
  }
}
