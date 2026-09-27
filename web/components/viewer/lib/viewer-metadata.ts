import type { Photo } from '@/lib/photo'
import {
  formatBytes,
  formatExposureBiasValue,
  formatFNumber,
  formatFocalLength,
  formatMegapixels,
  formatSentenceCase,
  NOT_AVAILABLE_LABEL,
} from '@/lib/photo/formatters'

interface InfoRowData {
  label: string
  value: string
}

export function getCreativeLookRows(
  photo: Pick<Photo, 'camera'>,
): InfoRowData[] {
  const look = photo.camera.creativeLook
  if (!look) return []

  const settings = [
    ['Contrast', look.contrast, true],
    ['Highlights', look.highlights, true],
    ['Shadows', look.shadows, true],
    ['Fade', look.fade, false],
    ['Saturation', look.saturation, true],
    ['Sharpness', look.sharpness, false],
    ['Sharpness Range', look.sharpnessRange, false],
    ['Clarity', look.clarity, false],
  ] as const

  return [
    { label: 'Look', value: look.name },
    ...settings.flatMap(([label, value, signed]) =>
      value === undefined
        ? []
        : [{ label, value: `${signed && value > 0 ? '+' : ''}${value}` }],
    ),
  ]
}

export function getLocationInfoRows(photo: Photo): InfoRowData[] {
  const rows = [{ label: 'Location', value: photo.album.title }]
  const location = photo.location
  if (!location) return []

  rows.push(
    {
      label: 'Latitude',
      value: `${Math.abs(location.lat).toFixed(6)}° ${location.lat < 0 ? 'S' : 'N'}`,
    },
    {
      label: 'Longitude',
      value: `${Math.abs(location.lng).toFixed(6)}° ${location.lng < 0 ? 'W' : 'E'}`,
    },
  )

  if (location.alt !== undefined) {
    rows.push({ label: 'Altitude', value: `${Math.round(location.alt)}m` })
  }

  return rows
}

export function getPhotoInfoRows(photo: Photo): InfoRowData[] {
  const rows: InfoRowData[] = [
    { label: 'Filename', value: photo.fileName },
    { label: 'Format', value: photo.format },
    {
      label: 'Dimensions',
      value: `${photo.original.width} × ${photo.original.height}`,
    },
    { label: 'File Size', value: formatBytes(photo.original.bytes) },
    {
      label: 'Megapixels',
      value: formatMegapixels(photo.original.width, photo.original.height),
    },
  ]

  if (photo.image.colorSpace) {
    rows.push({
      label: 'Color Space',
      value: photo.image.colorSpace,
    })
  }

  rows.push(
    {
      label: 'Capture Time',
      value: photo.captureTime.dateTime,
    },
    {
      label: 'Time Zone',
      value: photo.captureTime.timeZone,
    },
  )

  if (!photo.location) {
    rows.push({ label: 'Location', value: photo.album.title })
  }

  return rows
}

export function getDeviceInfoRows(photo: Photo): InfoRowData[] {
  const rows = [
    {
      label: 'Camera',
      value: photo.cameraName ?? NOT_AVAILABLE_LABEL,
    },
    {
      label: 'Lens',
      value: photo.camera.lensModel ?? NOT_AVAILABLE_LABEL,
    },
    ...(photo.camera.focalLengthIn35mmFilm === undefined ||
    photo.camera.focalLength === undefined ||
    photo.camera.focalLengthIn35mmFilm === photo.camera.focalLength
      ? []
      : [
          {
            label: '35mm Equivalent',
            value: formatFocalLength(photo.camera.focalLengthIn35mmFilm),
          },
        ]),
    {
      label: 'Max Aperture',
      value: formatFNumber(photo.camera.maxApertureFNumber),
    },
  ]

  return rows
}

export function getShootingSettingsRows(photo: Photo): InfoRowData[] {
  return [
    {
      label: 'Shooting Mode',
      value: formatSentenceCase(photo.camera.exposureProgram),
    },
    {
      label: 'Exposure Mode',
      value: formatSentenceCase(photo.camera.exposureMode),
    },
    ...(photo.camera.exposureBiasValue === undefined
      ? []
      : [
          {
            label: 'Exposure Compensation',
            value: formatExposureBiasValue(photo.camera.exposureBiasValue),
          },
        ]),
    {
      label: 'Metering Mode',
      value: formatSentenceCase(photo.camera.meteringMode),
    },
    {
      label: 'White Balance',
      value: formatSentenceCase(photo.camera.whiteBalance),
    },
    {
      label: 'Flash',
      value: formatSentenceCase(photo.camera.flash),
    },
    {
      label: 'Scene Capture Type',
      value: formatSentenceCase(photo.camera.sceneCaptureType),
    },
  ]
}
