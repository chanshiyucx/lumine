'use client'

import { X } from 'lucide-react'
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
    <div className="flex justify-between py-1 text-sm">
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
  isOpen?: boolean
  onClose?: () => void
}

function PhotoViewerInfoPanelContent({ photo }: { photo: GalleryPhoto }) {
  const photoInfoRows = getPhotoInfoRows(photo)
  const captureSettings = getCaptureSettings(photo)
  const deviceInfoRows = getDeviceInfoRows(photo)
  const exposureRows = getExposureRows(photo)

  return (
    <div className="space-y-6 p-4">
      <InfoSection title="Basic Info">
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

      <InfoSection title="Shooting Mode">
        {exposureRows.map((row) => (
          <InfoRow
            key={row.label}
            label={row.label}
            value={row.value}
            missing={row.missing}
          />
        ))}
      </InfoSection>
    </div>
  )
}

export function PhotoViewerInfoPanel({
  photo,
  isOpen = true,
  onClose,
}: PhotoViewerInfoPanelProps) {
  return (
    <aside
      aria-hidden={!isOpen}
      className={cn(
        'bg-surface/80 fixed inset-x-0 bottom-0 z-200 max-h-[40svh] overflow-hidden backdrop-blur-2xl transition-[width,transform,opacity] duration-300 ease-out lg:relative lg:inset-auto lg:bottom-auto lg:z-auto lg:h-full lg:max-h-none lg:shrink-0',
        isOpen
          ? 'translate-y-0 opacity-100 lg:w-80'
          : 'pointer-events-none translate-y-full opacity-0 lg:w-0 lg:translate-y-0',
      )}
    >
      <div
        className={cn(
          'flex max-h-[40svh] flex-col transition-transform duration-300 ease-out lg:h-full lg:max-h-none lg:w-80',
          !isOpen && 'lg:translate-x-full',
        )}
      >
        <div className="flex items-center justify-end px-4 py-3 lg:hidden">
          {onClose ? (
            <button
              type="button"
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center transition"
              onClick={onClose}
              aria-label="Close information panel"
            >
              <X className="size-5" strokeWidth={1.8} />
            </button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <PhotoViewerInfoPanelContent photo={photo} />
        </div>
      </div>
    </aside>
  )
}
