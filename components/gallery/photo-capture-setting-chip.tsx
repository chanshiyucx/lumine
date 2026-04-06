import {
  CarbonIsoOutline,
  FocalLength,
  ShutterSpeed,
  TablerAperture,
} from '@/components/icons'
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
}

export function PhotoCaptureSettingChip({
  setting,
}: PhotoCaptureSettingChipProps) {
  const Icon = captureSettingIcons[setting.key]

  return (
    <div className="bg-text/10 flex items-center gap-1.5 rounded-md px-2 py-1 opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
      <Icon />
      <span>{setting.value}</span>
    </div>
  )
}
