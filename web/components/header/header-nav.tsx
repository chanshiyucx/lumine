'use client'

import { LayoutGrid, LibraryBig } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/style'

const navItems = [
  {
    href: '/',
    label: 'Home',
    icon: LayoutGrid,
  },
  {
    href: '/albums',
    label: 'Albums',
    icon: LibraryBig,
  },
]

export function HeaderNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Primary" className="flex items-center gap-1">
      {navItems.map((item) => {
        const isActive =
          item.href === '/'
            ? pathname === '/' || pathname.startsWith('/photos/')
            : pathname.startsWith(item.href)
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'text-subtle hover:bg-overlay/70 hover:text-text inline-flex size-8 items-center justify-center rounded-lg transition-colors',
              isActive && 'bg-overlay/80 text-text',
            )}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="size-4" />
          </Link>
        )
      })}
    </nav>
  )
}
