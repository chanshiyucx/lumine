import {
  CarbonIsoOutline,
  FocalLength,
  ShutterSpeed,
  TablerAperture,
} from '@/components/icons'
import { cn } from '@/lib/style'
import type { CaptureSetting } from './lib/viewer-metadata'

const captureSettingIcons: Record<
  CaptureSetting['key'],
  React.ComponentType<React.SVGProps<SVGSVGElement>>
> = {
  focal: FocalLength,
  aperture: TablerAperture,
  shutter: ShutterSpeed,
  iso: CarbonIsoOutline,
}

interface PhotoCaptureSettingChipProps {
  setting: CaptureSetting
  className?: string
}

export function PhotoCaptureSettingChip({
  setting,
  className,
}: PhotoCaptureSettingChipProps) {
  const Icon = captureSettingIcons[setting.key]

  return (
    <div
      className={cn(
        'bg-text/10 flex items-center gap-1.5 rounded-md px-2 py-1 backdrop-blur-md',
        className,
      )}
    >
      <Icon />
      <span>{setting.value}</span>
    </div>
  )
}
