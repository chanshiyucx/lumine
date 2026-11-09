import { GithubFill } from '@mingcute/react/github'
import { PaperFill } from '@mingcute/react/paper'
import { Suspense } from 'react'
import { Logo } from '@/components/logo/logo'
import {
  HEADER_ICON_LINK_CLASS_NAME,
  PHOTO_COUNT_CLASS_NAME,
} from './lib/header-styles'
import { PhotoCount } from './photo-count'

const EXTERNAL_LINKS = [
  { href: 'https://github.com/chanshiyucx', label: 'GitHub', icon: GithubFill },
  { href: 'https://shiyu.me/', label: 'Blog', icon: PaperFill },
]

export function HeaderLeft() {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <Logo />
      <div className="hidden items-center gap-3 sm:flex">
        <Suspense
          fallback={
            <span aria-hidden="true" className={PHOTO_COUNT_CLASS_NAME}>
              ···
            </span>
          }
        >
          <PhotoCount />
        </Suspense>
        <span aria-hidden="true" className="bg-text/20 -mx-1 h-5 w-px" />
        <nav aria-label="External links" className="flex items-center gap-1">
          {EXTERNAL_LINKS.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className={HEADER_ICON_LINK_CLASS_NAME}
            >
              <Icon className="size-4" aria-hidden="true" />
            </a>
          ))}
        </nav>
      </div>
    </div>
  )
}
