import * as HoverCard from '@radix-ui/react-hover-card'
import type { ReactElement, ReactNode } from 'react'

export function MapHoverPreview({
  trigger,
  children,
  openDelay,
  closeDelay,
}: {
  trigger: ReactElement
  children: ReactNode
  openDelay: number
  closeDelay: number
}) {
  return (
    <HoverCard.Root openDelay={openDelay} closeDelay={closeDelay}>
      <HoverCard.Trigger asChild>{trigger}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          align="center"
          sideOffset={12}
          collisionPadding={16}
          className="z-50 w-80 outline-none"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {children}
          <HoverCard.Arrow className="fill-base/95" width={14} height={7} />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  )
}
