import { cn } from '@/lib/style'

interface LinearBlurProps {
  className?: string
  strength?: number
  tint?: string
}

const BLUR_LAYER_COUNT = 7
const MASK_STEP_PERCENTAGE = 100 / (BLUR_LAYER_COUNT + 1)
const MIN_BLUR_RADIUS = 0.5

function getMaskStop(step: number) {
  return `${step * MASK_STEP_PERCENTAGE}%`
}

// Layers blur less the further down they sit, from `strength` to MIN_BLUR_RADIUS.
function getBackdropFilter(strength: number, layerIndex: number) {
  const progress = layerIndex / (BLUR_LAYER_COUNT - 1)
  const blurRadius = strength * (MIN_BLUR_RADIUS / strength) ** progress

  return `blur(${blurRadius}px)`
}

/** A blur that fades out from the top edge downward. */
export function LinearBlur({
  className,
  strength = 64,
  tint = 'transparent',
}: LinearBlurProps) {
  return (
    <div className={cn('pointer-events-none relative', className)}>
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 z-1"
          style={{
            mask: `linear-gradient(to bottom, black 0%, black ${getMaskStop(1)}, transparent ${getMaskStop(2)})`,
            backdropFilter: getBackdropFilter(strength, 0),
          }}
        />
        {Array.from({ length: BLUR_LAYER_COUNT - 1 }, (_, index) => (
          <div
            key={index}
            className="absolute inset-0"
            style={{
              zIndex: index + 2,
              mask: `linear-gradient(to bottom, transparent ${getMaskStop(index)}, black ${getMaskStop(index + 1)}, black ${getMaskStop(index + 2)}, transparent ${getMaskStop(index + 3)})`,
              backdropFilter: getBackdropFilter(strength, index + 1),
            }}
          />
        ))}
        <div
          className="absolute -top-full left-0 size-full"
          style={{ boxShadow: `0 0 60px ${tint}, 0 0 100px ${tint}` }}
        />
      </div>
    </div>
  )
}
