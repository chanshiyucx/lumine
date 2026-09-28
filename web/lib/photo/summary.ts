interface PhotoCapture {
  takenAt: string
  cameraName: string | null
  captureTime: { date: string }
}

export function getPhotoSummary(photos: readonly PhotoCapture[]) {
  const first = photos[0]
  if (!first) throw new Error('Cannot summarize an empty photo collection')

  let earliest = first
  let latest = first
  let earliestTime = Date.parse(first.takenAt)
  let latestTime = earliestTime
  let cameraName = first.cameraName

  for (const photo of photos) {
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

  const earliestDate = earliest.captureTime.date
  const latestDate = latest.captureTime.date

  return {
    dateLabel:
      earliestDate === latestDate
        ? earliestDate
        : `${earliestDate} - ${latestDate}`,
    cameraName,
  }
}
