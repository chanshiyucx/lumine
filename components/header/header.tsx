import { LinearBlur } from '@/components/linear-blur'
import { Logo } from '@/components/logo'
import { HeaderCenter } from './header-center'

export function Header() {
  return (
    <header className="fixed top-0 right-0 left-0 z-100">
      <LinearBlur
        className="pointer-events-none absolute inset-x-0 z-[-1] h-15"
        tint="var(--color-base)"
        strength={128}
        side="top"
      />

      <div className="flex h-12 items-center justify-between gap-2 px-3 lg:gap-3 lg:px-4">
        <Logo />
        <HeaderCenter />
      </div>
    </header>
  )
}
