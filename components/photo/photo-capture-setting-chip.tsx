import {
  Aperture,
  CircleGauge,
  Clock3,
  Crosshair,
  type LucideIcon,
} from 'lucide-react'
import type { CaptureSetting } from './lib/viewer-metadata'

const captureSettingIcons: Record<CaptureSetting['key'], LucideIcon> = {
  focal: Crosshair,
  aperture: Aperture,
  shutter: Clock3,
  iso: CircleGauge,
}

interface PhotoCaptureSettingChipProps {
  setting: CaptureSetting
  variant?: 'compact' | 'detailed'
}

export function PhotoCaptureSettingChip({
  setting,
  variant = 'compact',
}: PhotoCaptureSettingChipProps) {
  const Icon = captureSettingIcons[setting.key]

  if (variant === 'detailed') {
    return (
      <div className="border-subtle/22 bg-overlay/42 rounded-xl border px-3 py-2">
        <div className="text-muted/78 flex items-center gap-2">
          <Icon className="size-3.5" strokeWidth={1.8} />
          <span className="text-[11px] tracking-[0.12em] uppercase">
            {setting.label}
          </span>
        </div>
        <p className="text-text/94 mt-1.5 text-sm">{setting.value}</p>
      </div>
    )
  }

  return (
    <div className="border-subtle/20 bg-overlay/84 text-text/94 flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 backdrop-blur-xl">
      <Icon className="text-muted/86 size-4 shrink-0" strokeWidth={1.8} />
      <span className="truncate text-[13px] leading-none">{setting.value}</span>
    </div>
  )
}
