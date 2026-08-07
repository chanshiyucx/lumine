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
  const isPinnable = pinned !== undefined && onPinnedChange !== undefined

  return (
    <HoverCard.Root
      open={isPinnable ? pinned || hoverOpen : undefined}
      onOpenChange={isPinnable ? setHoverOpen : undefined}
      openDelay={openDelay}
      closeDelay={closeDelay}
    >
      <HoverCard.Trigger
        asChild
        onPointerDown={
          isPinnable ? (event) => event.stopPropagation() : undefined
        }
        onClick={
          isPinnable
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
          className="album-map-hover-preview z-50 w-80 outline-none"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {children}
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  )
}
