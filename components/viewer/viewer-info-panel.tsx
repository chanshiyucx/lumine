'use client'

import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { CaptureSettingChip } from '@/components/gallery/capture-setting-chip'
import type { Photo } from '@/lib/photos'
import { cn } from '@/lib/style'
import {
  getCaptureSettings,
  getDeviceInfoRows,
  getExposureRows,
  getPhotoInfoRows,
} from './lib/viewer-metadata'

interface InfoRowProps {
  label: string
  value: string
  missing?: boolean
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <dt className="text-subtle pr-3">{label}</dt>
      <dd className="text-text break-all">{value}</dd>
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

interface ViewerInfoPanelProps {
  photo: Photo
  isOpen?: boolean
  onClose?: () => void
}

function ViewerInfoPanelContent({ photo }: { photo: Photo }) {
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
            <CaptureSettingChip key={setting.key} setting={setting} />
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

export function ViewerInfoPanel({
  photo,
  isOpen = true,
  onClose,
}: ViewerInfoPanelProps) {
  return (
    <aside
      aria-hidden={!isOpen}
      className={cn(
        'fixed inset-x-0 bottom-0 z-200 max-h-[40svh] overflow-hidden border-white/10 backdrop-blur-2xl transition-[width,transform,opacity] duration-200 ease-out lg:relative lg:inset-auto lg:bottom-auto lg:z-auto lg:h-full lg:max-h-none lg:shrink-0 lg:border-l',
        isOpen
          ? 'translate-y-0 opacity-100 lg:w-80'
          : 'pointer-events-none translate-y-full opacity-0 lg:w-0 lg:translate-y-0',
      )}
      style={{
        backgroundImage:
          'linear-gradient(to bottom right, color-mix(in srgb, var(--color-surface) 96%, transparent), color-mix(in srgb, var(--color-overlay) 92%, transparent), color-mix(in srgb, var(--color-base) 88%, transparent))',
        boxShadow:
          '0 8px 32px color-mix(in srgb, var(--color-base) 24%, transparent), 0 4px 16px color-mix(in srgb, black 14%, transparent)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            'linear-gradient(to bottom right, color-mix(in srgb, var(--color-text) 5%, transparent), transparent 45%, color-mix(in srgb, white 4%, transparent))',
        }}
      />

      <div className="relative flex max-h-[40svh] flex-col lg:h-full lg:max-h-none lg:w-80">
        <div className="flex items-center justify-end px-3 pt-3 lg:hidden">
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
        <div className="from-surface/80 pointer-events-none absolute bottom-0 left-0 z-10 h-10 w-screen bg-linear-to-t to-transparent lg:hidden"></div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <ViewerInfoPanelContent photo={photo} />
        </div>
      </div>
    </aside>
  )
}
