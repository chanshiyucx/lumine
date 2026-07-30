import type { Photo } from '.'
import {
  formatApertureValue,
  formatFocalLength,
  formatIsoValue,
  NOT_AVAILABLE_LABEL,
} from './formatters'

export interface CaptureSetting {
  key: 'focal' | 'aperture' | 'shutter' | 'iso'
  label: string
  value: string
}

export function getCaptureSettings(photo: Photo): CaptureSetting[] {
  return [
    {
      key: 'focal',
      label: 'Focal',
      value: formatFocalLength(
        photo.camera?.focalLengthIn35mm ?? photo.camera?.focalLengthMm,
      ),
    },
    {
      key: 'aperture',
      label: 'Aperture',
      value: formatApertureValue(photo.camera?.aperture),
    },
    {
      key: 'shutter',
      label: 'Shutter',
      value: photo.camera?.shutter ?? NOT_AVAILABLE_LABEL,
    },
    {
      key: 'iso',
      label: 'ISO',
      value: formatIsoValue(photo.camera?.iso),
    },
  ]
}

export function getAvailableCaptureSettings(photo: Photo): CaptureSetting[] {
  return getCaptureSettings(photo).filter(
    (setting) => setting.value !== NOT_AVAILABLE_LABEL,
  )
}
