'use client'

import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/style'

const ScrollElementContext = createContext<HTMLElement | null>(null)
const NATIVE_PAGE_SCROLL_QUERY = '(hover: none) and (pointer: coarse)'

interface ScrollAreaProps {
  ariaLabel?: string
  children: ReactNode
  className?: string
  scrollbarClassName?: string
  viewportClassName?: string
}

interface RadixScrollAreaProps extends ScrollAreaProps {
  variant: 'page' | 'panel'
}

export function useScrollElement() {
  return useContext(ScrollElementContext)
}

function RadixScrollArea({
  ariaLabel,
  children,
  className,
  scrollbarClassName,
  variant,
  viewportClassName,
}: RadixScrollAreaProps) {
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const isPage = variant === 'page'

  return (
    <ScrollElementContext.Provider value={viewport}>
      <ScrollAreaPrimitive.Root
        className={cn('relative overflow-hidden', isPage && 'h-svh', className)}
        scrollHideDelay={600}
        type="scroll"
      >
        <ScrollAreaPrimitive.Viewport
          ref={setViewport}
          aria-label={ariaLabel ?? (isPage ? 'Page content' : undefined)}
          className={cn(
            'size-full',
            isPage && 'overscroll-none [&>div]:block!',
            viewportClassName,
          )}
          data-scroll-viewport={variant}
          role={ariaLabel !== undefined || isPage ? 'region' : undefined}
          tabIndex={0}
        >
          {children}
        </ScrollAreaPrimitive.Viewport>

        <ScrollAreaPrimitive.Scrollbar
          className={cn(
            'z-90 flex w-2.5 touch-none p-0.5 transition-opacity duration-150 select-none',
            'data-[state=hidden]:opacity-0 data-[state=visible]:opacity-100',
            isPage && 'mt-12',
            scrollbarClassName,
          )}
          orientation="vertical"
        >
          <ScrollAreaPrimitive.Thumb className="bg-muted/50 hover:bg-muted/70 active:bg-muted/80 relative flex-1 rounded-full transition-colors" />
        </ScrollAreaPrimitive.Scrollbar>
      </ScrollAreaPrimitive.Root>
    </ScrollElementContext.Provider>
  )
}

export function ScrollArea(props: ScrollAreaProps) {
  return <RadixScrollArea {...props} variant="panel" />
}

export function PageScrollArea({
  children,
}: Pick<ScrollAreaProps, 'children'>) {
  const isNativePageScroll = useMediaQuery(NATIVE_PAGE_SCROLL_QUERY)

  if (isNativePageScroll) {
    return (
      <ScrollElementContext.Provider value={document.body}>
        {children}
      </ScrollElementContext.Provider>
    )
  }

  return <RadixScrollArea variant="page">{children}</RadixScrollArea>
}
