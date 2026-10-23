'use client'

import { Album2Line } from '@mingcute/react/album-2'
import { GridLine } from '@mingcute/react/grid'
import { LockLine } from '@mingcute/react/lock'
import { MapLine } from '@mingcute/react/map'
import { UnlockLine } from '@mingcute/react/unlock'
import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import { useSyncExternalStore } from 'react'
import {
  getPrivateModeHint,
  getPrivateModeHintOnServer,
  subscribePrivateModeHint,
} from '@/lib/private'
import { PRIVATE_PATH } from '@/lib/route-paths'
import { cn } from '@/lib/style'
import { isHeaderNavItemActive } from './lib/header-nav-state'

const navLinkClassName =
  'text-subtle hover:bg-text/10 hover:text-text inline-flex size-8 items-center justify-center rounded-lg transition-colors'
const activeNavLinkClassName = 'bg-text/10 text-text backdrop-blur-md'

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

interface HeaderRightProps {
  isPrivateModeAvailable: boolean
}

export function HeaderRight({ isPrivateModeAvailable }: HeaderRightProps) {
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
            className={cn(navLinkClassName, isActive && activeNavLinkClassName)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="size-4" aria-hidden="true" />
          </Link>
        )
      })}
      {isPrivateModeAvailable && (
        <PrivateModeLink
          isActive={isHeaderNavItemActive(segment, PRIVATE_PATH)}
        />
      )}
    </nav>
  )
}

function PrivateModeLink({ isActive }: { isActive: boolean }) {
  const isUnlocked = useSyncExternalStore(
    subscribePrivateModeHint,
    getPrivateModeHint,
    getPrivateModeHintOnServer,
  )
  const Icon = isUnlocked ? UnlockLine : LockLine

  return (
    <Link
      href={PRIVATE_PATH}
      prefetch={false}
      className={cn(navLinkClassName, isActive && activeNavLinkClassName)}
      aria-label={
        isUnlocked ? 'Private photos (unlocked)' : 'Private photos (locked)'
      }
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon className="size-4" aria-hidden="true" />
    </Link>
  )
}
