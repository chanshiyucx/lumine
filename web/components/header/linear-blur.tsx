import { cn } from '@/lib/style'

interface LinearBlurProps {
  className?: string
  strength?: number
  tint?: string
  side?: 'left' | 'right' | 'top' | 'bottom'
}

const BLUR_LAYER_COUNT = 7
const MASK_STEP_PERCENTAGE = 100 / (BLUR_LAYER_COUNT + 1)
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
}: LinearBlurProps) {
  const getBackdropFilter = (layerIndex: number) => {
    const progress = layerIndex / (BLUR_LAYER_COUNT - 1)
    const blurRadius = strength * (MIN_BLUR_RADIUS / strength) ** progress

    return `blur(${blurRadius}px)`
  }

  return (
    <div className={cn('pointer-events-none relative', className)}>
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 z-1"
          style={{
            mask: `linear-gradient(to ${oppositeSide[side]}, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 1) ${MASK_STEP_PERCENTAGE}%, rgba(0, 0, 0, 0) ${MASK_STEP_PERCENTAGE * 2}%)`,
            backdropFilter: getBackdropFilter(0),
          }}
        />
        {Array.from({ length: BLUR_LAYER_COUNT - 1 }, (_, index) => (
          <div
            key={index}
            className="absolute inset-0"
            style={{
              zIndex: index + 2,
              mask: `linear-gradient(to ${oppositeSide[side]},rgba(0, 0, 0, 0) ${index * MASK_STEP_PERCENTAGE}%,rgba(0, 0, 0, 1) ${(index + 1) * MASK_STEP_PERCENTAGE}%,rgba(0, 0, 0, 1) ${(index + 2) * MASK_STEP_PERCENTAGE}%,rgba(0, 0, 0, 0) ${(index + 3) * MASK_STEP_PERCENTAGE}%)`,
              backdropFilter: getBackdropFilter(index + 1),
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
