import { m, type MotionStyle } from 'motion/react'
import type { ReactNode } from 'react'
import { CaptureSettingChip } from '@/components/photo'
import { ScrollArea } from '@/components/scroll-area'
import type { Photo } from '@/lib/photo'
import { getCaptureSettings } from '@/lib/photo/capture-settings'
import { formatFocalLength } from '@/lib/photo/formatters'
import { cn } from '@/lib/style'
import {
  getCreativeLookRows,
  getDeviceInfoRows,
  getLocationInfoRows,
  getPhotoInfoRows,
  getShootingSettingsRows,
} from './lib/viewer-metadata'
import { VIEWER_MOTION } from './lib/viewer-motion'
import { PhotoHistogram } from './photo-histogram'
import { ViewerLocationMap } from './viewer-location-map'

interface InfoRowProps {
  className?: string
  label: string
  value: string
}

function InfoRow({ className, label, value }: InfoRowProps) {
  return (
    <div className={cn('flex justify-between gap-3 text-sm', className)}>
      <dt className="text-text/50 shrink-0 whitespace-nowrap">{label}</dt>
      <dd className="min-w-0 text-right wrap-anywhere">{value}</dd>
    </div>
  )
}

interface InfoSectionProps {
  title: string
  children: ReactNode
}

function InfoSection({ title, children }: InfoSectionProps) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium uppercase">{title}</h3>
      <dl className="flex flex-col gap-1">{children}</dl>
    </section>
  )
}

interface ViewerInfoPanelProps {
  photo: Photo
  isOpen: boolean
  isViewerInteractive: boolean
  isInputDisabled: boolean
  isViewerVisible: boolean
  presentation: { mode: 'desktop' } | { mode: 'mobile'; style: MotionStyle }
  onClose: () => void
}

const DESKTOP_PANEL_WIDTH_CLASS = 'lg:w-80'
const DESKTOP_PANEL_MOTION_CLASS =
  'motion-reduce:transition-none lg:transition-[width] lg:duration-200 lg:ease-out'

function ViewerInfoPanelContent({
  photo,
  isActive,
}: {
  photo: Photo
  isActive: boolean
}) {
  const photoInfoRows = getPhotoInfoRows(photo)
  const locationInfoRows = getLocationInfoRows(photo)
  const captureSettings = getCaptureSettings(photo).map((setting) =>
    setting.key === 'focal' && photo.camera.focalLength !== undefined
      ? { ...setting, value: formatFocalLength(photo.camera.focalLength) }
      : setting,
  )
  const creativeLookRows = getCreativeLookRows(photo)
  const deviceInfoRows = getDeviceInfoRows(photo)
  const shootingSettingsRows = getShootingSettingsRows(photo)

  return (
    <div className="space-y-6 p-4">
      <InfoSection title="Photo Information">
        {photoInfoRows.map((row) => (
          <InfoRow key={row.label} label={row.label} value={row.value} />
        ))}
      </InfoSection>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium uppercase">Capture Parameters</h3>
        <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
          {captureSettings.map((setting) => (
            <CaptureSettingChip key={setting.key} setting={setting} />
          ))}
        </div>
      </section>

      {creativeLookRows.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium uppercase">Creative Look</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            {creativeLookRows.map((row) => (
              <InfoRow
                key={row.label}
                className={row.label === 'Look' ? 'col-span-2' : 'gap-2'}
                label={row.label}
                value={row.value}
              />
            ))}
          </dl>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium uppercase">Histogram</h3>
        <PhotoHistogram photo={photo} isActive={isActive} />
      </section>

      <InfoSection title="Equipment">
        {deviceInfoRows.map((row) => (
          <InfoRow key={row.label} label={row.label} value={row.value} />
        ))}
      </InfoSection>

      <InfoSection title="Shooting Settings">
        {shootingSettingsRows.map((row) => (
          <InfoRow key={row.label} label={row.label} value={row.value} />
        ))}
      </InfoSection>

      <section
        hidden={photo.location === undefined}
        className="flex flex-col gap-2"
      >
        <h3 className="text-sm font-medium uppercase">Location</h3>
        <dl className="flex flex-col gap-1">
          {locationInfoRows.map((row) => (
            <InfoRow key={row.label} label={row.label} value={row.value} />
          ))}
        </dl>
        <ViewerLocationMap
          location={photo.location}
          photoId={photo.slug}
          isActive={isActive}
        />
      </section>
    </div>
  )
}

export function ViewerInfoPanel({
  photo,
  isOpen,
  isViewerInteractive,
  isInputDisabled,
  isViewerVisible,
  presentation,
  onClose,
}: ViewerInfoPanelProps) {
  const isMobilePresentation = presentation.mode === 'mobile'
  // A temporary input lock must not restart the histogram or map effects.
  const isActive = isOpen && isViewerVisible && isViewerInteractive
  const isInteractive = isActive && !isInputDisabled
  const panelMotionStyle: MotionStyle = isMobilePresentation
    ? presentation.style
    : { opacity: 1, y: 0 }

  return (
    <aside
      data-viewer-info-panel
      aria-hidden={!isInteractive}
      inert={!isInteractive}
      className={cn(
        'fixed inset-x-0 bottom-0 z-200 overflow-hidden pb-[env(safe-area-inset-bottom)] lg:relative lg:inset-auto lg:z-auto lg:h-full lg:shrink-0 lg:pb-0',
        DESKTOP_PANEL_MOTION_CLASS,
        isOpen ? DESKTOP_PANEL_WIDTH_CLASS : 'lg:w-0',
      )}
      style={{ pointerEvents: isInteractive ? 'auto' : 'none' }}
    >
      <m.div
        data-viewer-chrome="info-panel"
        className="h-full"
        initial={
          isMobilePresentation
            ? { opacity: 0, x: 0, y: 24 }
            : { opacity: 0, x: 32, y: 0 }
        }
        animate={
          isMobilePresentation
            ? {
                opacity: isViewerVisible ? 1 : 0,
                x: 0,
                y: isViewerVisible ? 0 : 24,
              }
            : {
                opacity: isViewerVisible ? 1 : 0,
                x: isViewerVisible ? 0 : 32,
                y: 0,
              }
        }
        transition={
          isViewerVisible
            ? VIEWER_MOTION.chrome.panel.enter
            : VIEWER_MOTION.chrome.panel.exit
        }
      >
        <m.div
          className={cn(
            'relative flex h-[min(max(68svh,22.5rem),calc(100svh-4.5rem))] min-h-0 flex-col overflow-hidden rounded-t-[28px] border-t border-white/5 shadow-[0_-8px_24px_rgb(0_0_0/0.08),inset_0_1px_0_rgb(255_255_255/0.03)] backdrop-blur-2xl lg:h-full lg:rounded-none lg:border-t-0 lg:shadow-none',
            DESKTOP_PANEL_WIDTH_CLASS,
          )}
          style={{
            backgroundColor: 'rgb(40 40 40 / 0.56)',
            ...panelMotionStyle,
          }}
        >
          <div className="relative flex h-6 shrink-0 items-start justify-center px-3 pt-2.5 lg:hidden">
            <button
              type="button"
              className="absolute inset-x-0 top-0 flex h-6 items-start justify-center pt-2.5"
              onClick={onClose}
              aria-label="Close information panel"
            >
              <span
                aria-hidden="true"
                className="bg-muted/60 h-1.5 w-11 rounded-full"
              />
            </button>
          </div>
          <ScrollArea
            ariaLabel="Photo information"
            className="min-h-0 flex-1"
            scrollbarClassName="my-2"
            viewportClassName="viewer-info-scroll-mask overscroll-contain"
          >
            <ViewerInfoPanelContent photo={photo} isActive={isActive} />
          </ScrollArea>
        </m.div>
      </m.div>
    </aside>
  )
}
