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
import { HEADER_ICON_LINK_CLASS_NAME } from './lib/header-styles'

const ACTIVE_NAV_LINK_CLASS_NAME = 'bg-text/10 text-text backdrop-blur-md'

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: GridLine },
  { href: '/albums', label: 'Albums', icon: Album2Line },
  { href: '/map', label: 'Map', icon: MapLine },
]

function getNavLinkClassName(isActive: boolean) {
  return cn(HEADER_ICON_LINK_CLASS_NAME, isActive && ACTIVE_NAV_LINK_CLASS_NAME)
}

interface HeaderRightProps {
  isPrivateModeAvailable: boolean
}

export function HeaderRight({ isPrivateModeAvailable }: HeaderRightProps) {
  const segment = useSelectedLayoutSegment()

  return (
    <nav aria-label="Primary" className="flex shrink-0 items-center gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = isHeaderNavItemActive(segment, href)

        return (
          <Link
            key={href}
            href={href}
            className={getNavLinkClassName(isActive)}
            aria-label={label}
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

interface PrivateModeLinkProps {
  isActive: boolean
}

function PrivateModeLink({ isActive }: PrivateModeLinkProps) {
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
      className={getNavLinkClassName(isActive)}
      aria-label={
        isUnlocked ? 'Private photos (unlocked)' : 'Private photos (locked)'
      }
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon className="size-4" aria-hidden="true" />
    </Link>
  )
}
