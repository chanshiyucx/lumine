import { Logo } from '@/components/logo'

export function Header() {
  return (
    <header className="bg-base/40 sticky top-0 z-10 flex h-12 w-full items-center justify-between gap-3 px-3 backdrop-blur-2xl">
      <Logo />
    </header>
  )
}
