import type { ComponentType, SVGProps } from 'react'
import {
  CarbonIsoOutline,
  FocalLength,
  ShutterSpeed,
  TablerAperture,
} from '@/components/icons'
import type { CaptureSetting } from '@/lib/photo/metadata'
import { cn } from '@/lib/style'

const CAPTURE_SETTING_ICONS: Record<
  CaptureSetting['key'],
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  focal: FocalLength,
  aperture: TablerAperture,
  shutter: ShutterSpeed,
  iso: CarbonIsoOutline,
}

interface CaptureSettingChipProps {
  setting: CaptureSetting
  className?: string
}

export function CaptureSettingChip({
  setting,
  className,
}: CaptureSettingChipProps) {
  const Icon = CAPTURE_SETTING_ICONS[setting.key]

  return (
    <div
      className={cn(
        'bg-text/10 flex items-center gap-1.5 rounded-md px-2 py-1',
        className,
      )}
    >
      <Icon />
      <span>{setting.value}</span>
    </div>
  )
}
