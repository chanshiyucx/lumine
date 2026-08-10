import { Logo } from '@/components/logo'
import { HeaderCenter } from './header-center'
import { HeaderNav } from './header-nav'
import { LinearBlur } from './linear-blur'

export function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-100" data-site-header>
      <LinearBlur
        className="absolute inset-x-0 -z-1 h-15"
        tint="var(--color-base)"
        strength={60}
      />

      <div className="flex h-12 items-center justify-between gap-2 px-3 lg:gap-3 lg:px-4">
        <Logo />
        <HeaderCenter />
        <HeaderNav />
      </div>
    </header>
  )
}
