'use client'

import { Camera } from 'lucide-react'
import type { ReactNode } from 'react'
import type { GalleryPhoto } from '@/lib/photos'
import { cn } from '@/lib/style'
import {
  getCaptureSettings,
  getDeviceInfoRows,
  getExposureRows,
  getMissingMetadataFields,
  getPhotoInfoRows,
} from '../lib/viewer-metadata'
import { PhotoCaptureSettingChip } from '../photo-capture-setting-chip'

interface InfoRowProps {
  label: string
  value: string
  missing?: boolean
}

function InfoRow({ label, value, missing = false }: InfoRowProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 py-1.5">
      <dt className="text-muted/74 text-[13px] leading-5">{label}</dt>
      <dd
        className={cn(
          'text-text/92 text-right text-[13px] leading-5',
          missing && 'text-subtle/80',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

interface InfoSectionProps {
  title: string
  children: ReactNode
}

function InfoSection({ title, children }: InfoSectionProps) {
  return (
    <section className="border-subtle/14 border-b py-4 last:border-b-0">
      <h3 className="text-muted/72 text-[11px] tracking-[0.18em] uppercase">
        {title}
      </h3>
      <dl className="divide-subtle/12 mt-2 divide-y">{children}</dl>
    </section>
  )
}

interface PhotoViewerInfoPanelProps {
  photo: GalleryPhoto
}

export function PhotoViewerInfoPanel({ photo }: PhotoViewerInfoPanelProps) {
  const photoInfoRows = getPhotoInfoRows(photo)
  const captureSettings = getCaptureSettings(photo)
  const deviceInfoRows = getDeviceInfoRows(photo)
  const exposureRows = getExposureRows(photo)
  const missingMetadataFields = getMissingMetadataFields(photo)

  return (
    <aside className="border-subtle/16 bg-surface/84 hidden w-[360px] shrink-0 overflow-y-auto border-l md:flex md:flex-col">
      <div className="px-6 py-2">
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

        <section className="border-subtle/14 border-b py-5">
          <h3 className="text-muted/72 text-[11px] tracking-[0.18em] uppercase">
            Capture Settings
          </h3>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {captureSettings.map((setting) => (
              <PhotoCaptureSettingChip
                key={setting.key}
                setting={setting}
                variant="detailed"
              />
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

        {missingMetadataFields.length > 0 ? (
          <div className="border-gold/18 bg-gold/8 my-4 rounded-xl border px-4 py-3">
            <div className="flex items-start gap-3">
              <Camera
                className="text-gold/78 mt-0.5 size-4 shrink-0"
                strokeWidth={1.8}
              />
              <div>
                <p className="text-gold/76 text-xs tracking-[0.16em] uppercase">
                  Missing Metadata
                </p>
                <p className="text-text/86 mt-1 text-sm leading-5">
                  {missingMetadataFields.join(', ')}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
