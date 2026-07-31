import { X } from 'lucide-react'
import { m, type MotionStyle } from 'motion/react'
import type { CSSProperties, ReactNode } from 'react'
import { CaptureSettingChip } from '@/components/photo'
import type { Photo } from '@/lib/photo'
import { getCaptureSettings } from '@/lib/photo/metadata'
import { cn } from '@/lib/style'
import {
  getDeviceInfoRows,
  getExposureRows,
  getPhotoInfoRows,
} from './lib/viewer-metadata'
import { ThumbHashCrossfade } from './thumbhash-crossfade'

const VIEWER_ACCENT = 'var(--viewer-accent, var(--color-iris))'
const PANEL_STYLE = {
  backgroundColor: 'color-mix(in srgb, var(--color-surface) 88%, transparent)',
  boxShadow: `0 8px 32px color-mix(in srgb, ${VIEWER_ACCENT} 13%, transparent), 0 4px 16px color-mix(in srgb, ${VIEWER_ACCENT} 10%, transparent), 0 2px 8px color-mix(in srgb, black 10%, transparent)`,
} satisfies CSSProperties
const PANEL_OVERLAY_STYLE = {
  backgroundImage: [
    `linear-gradient(to bottom right, color-mix(in srgb, ${VIEWER_ACCENT} 7%, transparent), transparent, color-mix(in srgb, ${VIEWER_ACCENT} 8%, transparent))`,
    'linear-gradient(to bottom right, color-mix(in srgb, var(--color-base) 64%, transparent), color-mix(in srgb, var(--color-overlay) 58%, transparent) 52%, color-mix(in srgb, var(--color-base) 72%, transparent))',
    'linear-gradient(to bottom, color-mix(in srgb, black 16%, transparent), transparent 44%, color-mix(in srgb, black 24%, transparent))',
  ].join(', '),
} satisfies CSSProperties

interface InfoRowProps {
  label: string
  value: string
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <dt className="text-subtle pr-3">{label}</dt>
      <dd className="break-all">{value}</dd>
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
  isOpen: boolean
  mobileStyle?: MotionStyle
  onClose: () => void
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
          <InfoRow key={row.label} label={row.label} value={row.value} />
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
          <InfoRow key={row.label} label={row.label} value={row.value} />
        ))}
      </InfoSection>

      <InfoSection title="Shooting Mode">
        {exposureRows.map((row) => (
          <InfoRow key={row.label} label={row.label} value={row.value} />
        ))}
      </InfoSection>
    </div>
  )
}

export function ViewerInfoPanel({
  photo,
  isOpen,
  mobileStyle,
  onClose,
}: ViewerInfoPanelProps) {
  const isMobileMotionControlled = mobileStyle !== undefined

  return (
    <m.aside
      aria-hidden={!isOpen}
      inert={!isOpen}
      className={cn(
        'bg-surface fixed inset-x-0 bottom-0 z-200 overflow-hidden pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl transition-[width,transform,opacity] duration-200 ease-out lg:relative lg:inset-auto lg:z-auto lg:h-full lg:shrink-0 lg:pb-0',
        isOpen ? 'lg:w-80' : 'pointer-events-none lg:w-0',
        !isMobileMotionControlled &&
          (isOpen
            ? 'translate-y-0 opacity-100'
            : 'translate-y-full opacity-0 lg:translate-y-0'),
      )}
      style={{ ...PANEL_STYLE, ...mobileStyle }}
    >
      <ThumbHashCrossfade
        photoId={photo.id}
        thumbHash={photo.thumbHash}
        imageClassName="object-cover"
      />

      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={PANEL_OVERLAY_STYLE}
      />

      <div className="relative flex max-h-[40svh] flex-col lg:h-full lg:max-h-none lg:w-80">
        <div className="flex justify-end px-3 pt-3 lg:hidden">
          <button
            type="button"
            className="inline-flex size-8 cursor-pointer items-center justify-center"
            onClick={onClose}
            aria-label="Close information panel"
          >
            <X className="size-5" strokeWidth={1.8} />
          </button>
        </div>
        <div className="from-surface/80 pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-linear-to-t to-transparent lg:hidden" />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <ViewerInfoPanelContent photo={photo} />
        </div>
      </div>
    </m.aside>
  )
}
