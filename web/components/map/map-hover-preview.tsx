import * as HoverCard from '@radix-ui/react-hover-card'
import { useState, type ReactElement, type ReactNode } from 'react'

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
          onPinnedChange ? (event) => event.stopPropagation() : undefined
        }
        onClick={
          onPinnedChange
            ? (event) => {
                event.stopPropagation()
                const nextPinned = !pinned
                if (!nextPinned) setHoverOpen(false)
                onPinnedChange(nextPinned)
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
          className="album-map-hover-preview z-50 w-[min(20rem,calc(100vw-2rem))] outline-none"
        >
          {children}
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  )
}
