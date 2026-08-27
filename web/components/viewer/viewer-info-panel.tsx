import { m, type MotionStyle } from 'motion/react'
import type { ReactNode } from 'react'
import { CaptureSettingChip } from '@/components/photo'
import { ScrollArea } from '@/components/scroll-area'
import type { Photo } from '@/lib/photo'
import { getCaptureSettings } from '@/lib/photo/metadata'
import { cn } from '@/lib/style'
import {
  getDeviceInfoRows,
  getExposureRows,
  getPhotoInfoRows,
} from './lib/viewer-metadata'
import { VIEWER_MOTION } from './lib/viewer-motion'
import { PhotoHistogram } from './photo-histogram'

interface InfoRowProps {
  label: string
  value: string
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <dt className="text-text/50 pr-3">{label}</dt>
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
  isViewerInteractive: boolean
  isViewerVisible: boolean
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
        <div className="mt-2">
          <PhotoHistogram photo={photo} />
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
  isViewerInteractive,
  isViewerVisible,
  mobileStyle,
  onClose,
}: ViewerInfoPanelProps) {
  const isMobileMotionControlled = mobileStyle !== undefined
  const isInteractive = isOpen && isViewerVisible && isViewerInteractive

  return (
    <aside
      data-viewer-info-panel
      aria-hidden={!isInteractive}
      inert={!isInteractive}
      className={cn(
        'fixed inset-x-0 bottom-0 z-200 overflow-hidden pb-[env(safe-area-inset-bottom)] transition-[width] duration-200 ease-out motion-reduce:transition-none lg:relative lg:inset-auto lg:z-auto lg:h-full lg:shrink-0 lg:pb-0',
        isOpen ? 'lg:w-80' : 'lg:w-0',
      )}
      style={{ pointerEvents: isInteractive ? 'auto' : 'none' }}
    >
      <m.div
        data-viewer-chrome="info-panel"
        className="h-full"
        initial={
          isMobileMotionControlled
            ? { opacity: 0, x: 0, y: 24 }
            : { opacity: 0, x: 32, y: 0 }
        }
        animate={
          isMobileMotionControlled
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
          className="relative flex h-[min(max(68svh,22.5rem),calc(100svh-4.5rem))] flex-col overflow-hidden rounded-t-[28px] border-t border-white/5 shadow-[0_-8px_24px_rgb(0_0_0/0.08),inset_0_1px_0_rgb(255_255_255/0.03)] backdrop-blur-2xl lg:h-full lg:w-80 lg:rounded-none lg:border-t-0 lg:border-l lg:shadow-[-8px_0_24px_rgb(0_0_0/0.08),inset_1px_0_0_rgb(255_255_255/0.03)]"
          style={{
            backgroundColor: 'rgb(40 40 40 / 0.56)',
            ...mobileStyle,
          }}
        >
          <div className="relative flex min-h-0 flex-1 flex-col">
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
              <ViewerInfoPanelContent photo={photo} />
            </ScrollArea>
          </div>
        </m.div>
      </m.div>
    </aside>
  )
}
