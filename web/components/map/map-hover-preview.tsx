import * as HoverCard from '@radix-ui/react-hover-card'
import { useRef, useState, type ReactElement, type ReactNode } from 'react'

type MapHoverPreviewProps = {
  trigger: ReactElement
  children: ReactNode
  openDelay: number
  closeDelay: number
} & (
  | { pinned: boolean; onPinnedChange: (pinned: boolean) => void }
  | { pinned?: never; onPinnedChange?: never }
)

export function MapHoverPreview({
  trigger,
  children,
  openDelay,
  closeDelay,
  pinned,
  onPinnedChange,
}: MapHoverPreviewProps) {
  const [hoverOpen, setHoverOpen] = useState(false)
  const touchActivatedRef = useRef(false)
  const togglePinned = () => {
    const nextPinned = !pinned
    if (!nextPinned) {
      setHoverOpen(false)
    }
    onPinnedChange?.(nextPinned)
  }

  // A pinnable preview is controlled so a pin keeps it open, and pressing the
  // trigger toggles the pin. Otherwise Radix handles hover on its own.
  const rootProps: Partial<HoverCard.HoverCardProps> = onPinnedChange
    ? { open: pinned || hoverOpen, onOpenChange: setHoverOpen }
    : {}
  const triggerProps: Partial<HoverCard.HoverCardTriggerProps> = onPinnedChange
    ? {
        onPointerDown: (event) => {
          event.stopPropagation()
          touchActivatedRef.current = event.pointerType === 'touch'
          if (touchActivatedRef.current) {
            togglePinned()
          }
        },
        onClick: (event) => {
          event.stopPropagation()
          // A touch already toggled on pointerdown; keyboard clicks have no detail.
          if (!touchActivatedRef.current || event.detail === 0) {
            togglePinned()
          }
        },
      }
    : {}

  return (
    <HoverCard.Root
      {...rootProps}
      openDelay={openDelay}
      closeDelay={closeDelay}
    >
      <HoverCard.Trigger asChild {...triggerProps}>
        {trigger}
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          align="center"
          sideOffset={10}
          collisionPadding={16}
          updatePositionStrategy={pinned ? 'always' : 'optimized'}
          hideWhenDetached={pinned}
          className="map-hover-preview border-overlay bg-surface z-50 max-h-(--radix-hover-card-content-available-height) w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border shadow-xl outline-none"
        >
          {children}
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  )
}
