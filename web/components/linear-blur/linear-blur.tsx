import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/style'

interface LinearBlurProps extends HTMLAttributes<HTMLDivElement> {
  strength?: number
  steps?: number
  falloffPercentage?: number
  tint?: string
  side?: 'left' | 'right' | 'top' | 'bottom'
}

const oppositeSide = {
  left: 'right',
  right: 'left',
  top: 'bottom',
  bottom: 'top',
}

const transformOriginClass = {
  left: 'origin-left',
  right: 'origin-right',
  top: 'origin-top',
  bottom: 'origin-bottom',
}

export function LinearBlur({
  strength = 64,
  steps = 8,
  falloffPercentage = 100,
  tint = 'transparent',
  side = 'top',
  ...props
}: LinearBlurProps) {
  const step = falloffPercentage / steps

  const factor = 0.5

  const base = Math.pow(strength / factor, 1 / (steps - 1))

  const mainPercentage = 100 - falloffPercentage

  const getBackdropFilter = (i: number) =>
    `blur(${factor * base ** (steps - i - 1)}px)`

  return (
    <div
      {...props}
      className={cn(
        props.className,
        'pointer-events-none',
        transformOriginClass[side],
      )}
    >
      <div className="absolute z-0 size-full">
        {/* Full blur at 100-falloffPercentage% */}
        {steps > 1 && (
          <div
            className="absolute inset-0 z-1"
            style={{
              mask: `linear-gradient(to ${oppositeSide[side]}, rgba(0, 0, 0, 1) ${mainPercentage}%, rgba(0, 0, 0, 1) ${mainPercentage + step}%, rgba(0, 0, 0, 0) ${mainPercentage + step * 2}%)`,
              backdropFilter: getBackdropFilter(1),
              WebkitBackdropFilter: getBackdropFilter(1),
            }}
          />
        )}
        {steps > 2 &&
          Array.from({ length: steps - 2 }).map((_, i) => (
            <div
              key={i}
              className="absolute inset-0"
              style={{
                zIndex: i + 2,
                mask: `linear-gradient(to ${oppositeSide[side]},rgba(0, 0, 0, 0) ${mainPercentage + i * step}%,rgba(0, 0, 0, 1) ${mainPercentage + (i + 1) * step}%,rgba(0, 0, 0, 1) ${mainPercentage + (i + 2) * step}%,rgba(0, 0, 0, 0) ${mainPercentage + (i + 3) * step}%)`,
                backdropFilter: getBackdropFilter(i + 2),
                WebkitBackdropFilter: getBackdropFilter(i + 2),
              }}
            />
          ))}
        <div
          className={`absolute size-full ${
            side === 'top'
              ? '-top-full left-0'
              : side === 'bottom'
                ? '-bottom-full left-0'
                : side === 'left'
                  ? 'top-0 -left-full'
                  : 'top-0 -right-full'
          }`}
          style={{ boxShadow: `0 0 60px ${tint}, 0 0 100px ${tint}` }}
        />
      </div>
    </div>
  )
}
