import * as HoverCard from '@radix-ui/react-hover-card'
import { useRef, useState, type ReactElement, type ReactNode } from 'react'

export function MapHoverPreview({
  trigger,
  children,
  openDelay,
  closeDelay,
  pinned,
  onPinnedChange,
}: {
  trigger: ReactElement
  children: ReactNode
  openDelay: number
  closeDelay: number
  pinned?: boolean
  onPinnedChange?: (pinned: boolean) => void
}) {
  const [hoverOpen, setHoverOpen] = useState(false)
  const touchActivated = useRef(false)
  const togglePinned = () => {
    const nextPinned = !pinned
    if (!nextPinned) setHoverOpen(false)
    onPinnedChange?.(nextPinned)
  }

  return (
    <HoverCard.Root
      open={onPinnedChange ? pinned || hoverOpen : undefined}
      onOpenChange={onPinnedChange ? setHoverOpen : undefined}
      openDelay={openDelay}
      closeDelay={closeDelay}
    >
      <HoverCard.Trigger
        asChild
        onPointerDown={
          onPinnedChange
            ? (event) => {
                event.stopPropagation()
                touchActivated.current = event.pointerType === 'touch'
                if (touchActivated.current) togglePinned()
              }
            : undefined
        }
        onClick={
          onPinnedChange
            ? (event) => {
                event.stopPropagation()
                if (!touchActivated.current || event.detail === 0)
                  togglePinned()
              }
            : undefined
        }
      >
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
          className="map-hover-preview z-50 max-h-[var(--radix-hover-card-content-available-height)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl outline-none"
        >
          {children}
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  )
}
