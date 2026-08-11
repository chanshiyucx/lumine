import { getAlbumDescriptor } from '@/lib/albums'
import type { Photo } from '@/lib/photo'
import {
  formatApertureValue,
  formatBrightnessValue,
  formatBytes,
  formatDateTimeLabel,
  formatFocalLength,
  formatMegapixels,
  formatMimeLabel,
  formatSentenceCase,
  formatTimeZoneLabel,
  NOT_AVAILABLE_LABEL,
} from '@/lib/photo/formatters'

interface InfoRowData {
  label: string
  value: string
}

export function getPhotoInfoRows(photo: Photo): InfoRowData[] {
  const album = getAlbumDescriptor(photo.albumKey)

  return [
    { label: 'File Name', value: photo.fileName },
    { label: 'Format', value: formatMimeLabel(photo) },
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
      value: photo.image?.colorSpace ?? NOT_AVAILABLE_LABEL,
    },
    {
      label: 'Location',
      value: album.title,
    },
    { label: 'Taken At', value: formatDateTimeLabel(photo.takenAt) },
    { label: 'Time Zone', value: formatTimeZoneLabel(photo.takenAt) },
  ]
}

export function getDeviceInfoRows(photo: Photo): InfoRowData[] {
  return [
    {
      label: 'Camera',
      value:
        [photo.camera?.make, photo.camera?.model].filter(Boolean).join(' ') ||
        NOT_AVAILABLE_LABEL,
    },
    {
      label: 'Lens',
      value: photo.camera?.lens ?? NOT_AVAILABLE_LABEL,
    },
    {
      label: 'Focal Length',
      value: formatFocalLength(photo.camera?.focalLengthMm),
    },
    {
      label: '35mm Equivalent',
      value: formatFocalLength(photo.camera?.focalLengthIn35mm),
    },
    {
      label: 'Max Aperture',
      value: formatApertureValue(photo.camera?.maxAperture),
    },
  ]
}

export function getExposureRows(photo: Photo): InfoRowData[] {
  return [
    {
      label: 'Exposure Program',
      value: formatSentenceCase(photo.camera?.exposureProgram),
    },
    {
      label: 'Exposure Mode',
      value: formatSentenceCase(photo.camera?.exposureMode),
    },
    {
      label: 'Metering Mode',
      value: formatSentenceCase(photo.camera?.meteringMode),
    },
    {
      label: 'White Balance',
      value: formatSentenceCase(photo.camera?.whiteBalance),
    },
    {
      label: 'Flash',
      value: formatSentenceCase(photo.camera?.flash),
    },
    {
      label: 'Sensing Method',
      value: formatSentenceCase(photo.camera?.sensingMethod),
    },
    {
      label: 'Scene Capture Type',
      value: formatSentenceCase(photo.camera?.sceneCaptureType),
    },
    {
      label: 'Brightness',
      value: formatBrightnessValue(photo.camera?.brightnessEv),
    },
  ]
}
