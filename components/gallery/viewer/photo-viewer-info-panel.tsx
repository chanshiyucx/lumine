'use client'

import type { ReactNode } from 'react'
import type { GalleryPhoto } from '@/lib/photos'
import { cn } from '@/lib/style'
import {
  getCaptureSettings,
  getDeviceInfoRows,
  getExposureRows,
  getPhotoInfoRows,
} from '../lib/viewer-metadata'
import { PhotoCaptureSettingChip } from '../photo-capture-setting-chip'

interface InfoRowProps {
  label: string
  value: string
  missing?: boolean
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <dt className="text-subtle">{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  )
}

interface InfoSectionProps {
  title: string
  children: ReactNode
}

function InfoSection({ title, children }: InfoSectionProps) {
  return (
    <section>
      <h3 className="text-sm uppercase">{title}</h3>
      <dl>{children}</dl>
    </section>
  )
}

interface PhotoViewerInfoPanelProps {
  photo: GalleryPhoto
  isMobile?: boolean
  onClose?: () => void
}

export function PhotoViewerInfoPanel({ photo }: PhotoViewerInfoPanelProps) {
  const photoInfoRows = getPhotoInfoRows(photo)
  const captureSettings = getCaptureSettings(photo)
  const deviceInfoRows = getDeviceInfoRows(photo)
  const exposureRows = getExposureRows(photo)

  return (
    <aside className="bg-surface/80 flex w-80 shrink-0 flex-col space-y-6 overflow-y-auto p-4 backdrop-blur-2xl">
      <InfoSection title="Photo Info">
        {photoInfoRows.map((row) => (
          <InfoRow
            key={row.label}
            label={row.label}
            value={row.value}
            missing={row.missing}
          />
        ))}
      </InfoSection>

      <section>
        <h3 className="text-sm uppercase">Capture Settings</h3>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          {captureSettings.map((setting) => (
            <PhotoCaptureSettingChip key={setting.key} setting={setting} />
          ))}
        </div>
      </section>

      <InfoSection title="Device Info">
        {deviceInfoRows.map((row) => (
          <InfoRow
            key={row.label}
            label={row.label}
            value={row.value}
            missing={row.missing}
          />
        ))}
      </InfoSection>

      <InfoSection title="Exposure">
        {exposureRows.map((row) => (
          <InfoRow
            key={row.label}
            label={row.label}
            value={row.value}
            missing={row.missing}
          />
        ))}
      </InfoSection>
    </aside>
  )
}
