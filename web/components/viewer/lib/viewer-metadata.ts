import { formatCoordinates } from '@/lib/coordinates'
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

const EXPOSURE_MODE_LABELS: Record<string, string> = {
  auto: 'Auto Exposure',
  manual: 'Manual Exposure',
  bracket: 'Exposure Bracketing',
}

const METERING_MODE_LABELS: Record<string, string> = {
  average: 'Average',
  'center weighted average': 'Center-weighted average',
  'center weighted': 'Center-weighted average',
  center: 'Center-weighted average',
  spot: 'Spot',
  'multi spot': 'Multi-spot',
  pattern: 'Multi-segment',
  'multi segment': 'Multi-segment',
  multi: 'Multi-segment',
  partial: 'Partial',
  other: 'Other',
}

function getAvailableMetadataRows(rows: InfoRowData[]): InfoRowData[] {
  return rows.filter(
    ({ value }) =>
      value.trim() !== '' && !/^(unknown|not defined)$/i.test(value.trim()),
  )
}

function formatShootingMode(value?: string): string {
  return formatSentenceCase(value?.trim()).replace(/\b[a-z]/g, (letter) =>
    letter.toUpperCase(),
  )
}

function formatExposureMode(value?: string): string {
  return (
    EXPOSURE_MODE_LABELS[value?.trim().toLowerCase() ?? ''] ??
    formatShootingMode(value)
  )
}

function formatMeteringMode(value?: string): string {
  const key = value
    ?.trim()
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
  return METERING_MODE_LABELS[key ?? ''] ?? formatSentenceCase(value?.trim())
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
  const { latitude, longitude } = formatCoordinates(location)

  rows.push(
    {
      label: 'Latitude',
      value: latitude,
    },
    {
      label: 'Longitude',
      value: longitude,
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
    {
      label: 'Focal Length',
      value: formatFocalLength(photo.camera.focalLength),
    },
    ...(photo.camera.focalLengthIn35mmFilm === undefined ||
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

  return getAvailableMetadataRows(rows)
}

export function getShootingSettingsRows(photo: Photo): InfoRowData[] {
  return getAvailableMetadataRows([
    {
      label: 'Shooting Mode',
      value: formatShootingMode(photo.camera.exposureProgram),
    },
    {
      label: 'Exposure Mode',
      value: formatExposureMode(photo.camera.exposureMode),
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
      value: formatMeteringMode(photo.camera.meteringMode),
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
  ])
}
