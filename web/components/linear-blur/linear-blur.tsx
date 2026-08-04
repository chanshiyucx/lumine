import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/style'

interface LinearBlurProps extends HTMLAttributes<HTMLDivElement> {
  strength?: number
  tint?: string
  side?: 'left' | 'right' | 'top' | 'bottom'
}

const BLUR_STEPS = 8
const FALLOFF_PERCENTAGE = 100
const MIN_BLUR_RADIUS = 0.5

const oppositeSide = {
  left: 'right',
  right: 'left',
  top: 'bottom',
  bottom: 'top',
}

const tintOffsetClass = {
  left: 'top-0 -left-full',
  right: 'top-0 -right-full',
  top: '-top-full left-0',
  bottom: '-bottom-full left-0',
}

export function LinearBlur({
  className,
  strength = 64,
  tint = 'transparent',
  side = 'top',
  ...props
}: LinearBlurProps) {
  const falloffStep = FALLOFF_PERCENTAGE / BLUR_STEPS
  const blurGrowthFactor = Math.pow(
    strength / MIN_BLUR_RADIUS,
    1 / (BLUR_STEPS - 1),
  )
  const solidPercentage = 100 - FALLOFF_PERCENTAGE

  const getBackdropFilter = (layerIndex: number) =>
    `blur(${MIN_BLUR_RADIUS * blurGrowthFactor ** (BLUR_STEPS - layerIndex - 1)}px)`

  return (
    <div
      {...props}
      className={cn('relative', className, 'pointer-events-none')}
    >
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 z-1"
          style={{
            mask: `linear-gradient(to ${oppositeSide[side]}, rgba(0, 0, 0, 1) ${solidPercentage}%, rgba(0, 0, 0, 1) ${solidPercentage + falloffStep}%, rgba(0, 0, 0, 0) ${solidPercentage + falloffStep * 2}%)`,
            backdropFilter: getBackdropFilter(1),
            WebkitBackdropFilter: getBackdropFilter(1),
          }}
        />
        {Array.from({ length: BLUR_STEPS - 2 }, (_, index) => (
          <div
            key={index}
            className="absolute inset-0"
            style={{
              zIndex: index + 2,
              mask: `linear-gradient(to ${oppositeSide[side]},rgba(0, 0, 0, 0) ${solidPercentage + index * falloffStep}%,rgba(0, 0, 0, 1) ${solidPercentage + (index + 1) * falloffStep}%,rgba(0, 0, 0, 1) ${solidPercentage + (index + 2) * falloffStep}%,rgba(0, 0, 0, 0) ${solidPercentage + (index + 3) * falloffStep}%)`,
              backdropFilter: getBackdropFilter(index + 2),
              WebkitBackdropFilter: getBackdropFilter(index + 2),
            }}
          />
        ))}
        <div
          className={cn('absolute size-full', tintOffsetClass[side])}
          style={{ boxShadow: `0 0 60px ${tint}, 0 0 100px ${tint}` }}
        />
      </div>
    </div>
  )
}
