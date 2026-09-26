import type { Photo } from '@/lib/photo'
import {
  formatBrightnessValue,
  formatBytes,
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

export function getPhotoInfoRows(photo: Photo): InfoRowData[] {
  return [
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
    {
      label: 'Color Space',
      value: photo.image.colorSpace ?? NOT_AVAILABLE_LABEL,
    },
    {
      label: 'Location',
      value: photo.album.title,
    },
    {
      label: 'Capture Time',
      value: photo.captureTime.dateTime,
    },
    {
      label: 'Time Zone',
      value: photo.captureTime.timeZone,
    },
  ]
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
    {
      label: '35mm Equivalent',
      value: formatFocalLength(photo.camera.focalLengthIn35mmFilm),
    },
    {
      label: 'Max Aperture',
      value: formatFNumber(photo.camera.maxApertureFNumber),
    },
  ]

  if (photo.camera.lensMake) {
    rows.splice(1, 0, {
      label: 'Lens Manufacturer',
      value: photo.camera.lensMake,
    })
  }
  if (photo.camera.sensingMethod) {
    rows.push({
      label: 'Sensing Method',
      value: formatSentenceCase(photo.camera.sensingMethod),
    })
  }
  return rows
}

export function getExposureRows(photo: Photo): InfoRowData[] {
  return [
    {
      label: 'Exposure Program',
      value: formatSentenceCase(photo.camera.exposureProgram),
    },
    {
      label: 'Exposure Mode',
      value: formatSentenceCase(photo.camera.exposureMode),
    },
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
    {
      label: 'Brightness',
      value: formatBrightnessValue(photo.camera.brightnessValue),
    },
  ]
}
