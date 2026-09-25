import { GithubFill } from '@mingcute/react/github'
import { PaperFill } from '@mingcute/react/paper'
import { Suspense } from 'react'
import { Logo } from '@/components/logo'
import { PhotoCount } from './photo-count'

export function HeaderLeft() {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <Logo />
      <div className="hidden items-center gap-3 sm:flex">
        <Suspense
          fallback={
            <span
              aria-hidden="true"
              className="text-subtle min-w-[3ch] text-xs font-semibold lg:text-sm"
            >
              ···
            </span>
          }
        >
          <PhotoCount />
        </Suspense>
        <span aria-hidden="true" className="bg-text/20 -mx-1 h-5 w-px" />
        <nav aria-label="External links" className="flex items-center gap-1">
          <a
            href="https://github.com/chanshiyucx"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="text-subtle hover:bg-text/10 hover:text-text inline-flex size-8 items-center justify-center rounded-lg transition-colors"
          >
            <GithubFill className="size-4" aria-hidden="true" />
          </a>
          <a
            href="https://shiyu.me/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Blog"
            className="text-subtle hover:bg-text/10 hover:text-text inline-flex size-8 items-center justify-center rounded-lg transition-colors"
          >
            <PaperFill className="size-4" aria-hidden="true" />
          </a>
        </nav>
      </div>
    </div>
  )
}
