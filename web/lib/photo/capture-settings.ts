import type { Photo } from '.'
import {
  formatExposureTime,
  formatFNumber,
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
        photo.camera.focalLengthIn35mmFilm ?? photo.camera.focalLength,
      ),
    },
    {
      key: 'aperture',
      label: 'Aperture',
      value: formatFNumber(photo.camera.fNumber),
    },
    {
      key: 'shutter',
      label: 'Shutter',
      value: formatExposureTime(photo.camera.exposureTime),
    },
    {
      key: 'iso',
      label: 'ISO',
      value: formatIsoValue(photo.camera.iso),
    },
  ]
}

export function getAvailableCaptureSettings(photo: Photo): CaptureSetting[] {
  return getCaptureSettings(photo).filter(
    (setting) => setting.value !== NOT_AVAILABLE_LABEL,
  )
}
