'use client'

import { Album2Line } from '@mingcute/react/album-2'
import { GridLine } from '@mingcute/react/grid'
import { MapLine } from '@mingcute/react/map'
import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import { cn } from '@/lib/style'
import { isHeaderNavItemActive } from './lib/header-nav-state'

const navItems = [
  {
    href: '/',
    label: 'Home',
    icon: GridLine,
  },
  {
    href: '/albums',
    label: 'Albums',
    icon: Album2Line,
  },
  {
    href: '/map',
    label: 'Map',
    icon: MapLine,
  },
]

export function HeaderRight() {
  const segment = useSelectedLayoutSegment()

  return (
    <nav aria-label="Primary" className="flex shrink-0 items-center gap-1">
      {navItems.map((item) => {
        const isActive = isHeaderNavItemActive(segment, item.href)
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'text-subtle hover:bg-text/10 hover:text-text inline-flex size-8 items-center justify-center rounded-lg transition-colors',
              isActive && 'bg-text/10 text-text backdrop-blur-md',
            )}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="size-4" aria-hidden="true" />
          </Link>
        )
      })}
    </nav>
  )
}
