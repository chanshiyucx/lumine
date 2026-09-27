import type { Photo } from '.'
import {
  formatExposureTime,
  formatFNumber,
  formatFocalLength,
  formatIsoValue,
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
