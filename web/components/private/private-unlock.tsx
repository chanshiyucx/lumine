'use client'

import { ArrowRightLine } from '@mingcute/react/arrow-right'
import { EyeLine } from '@mingcute/react/eye'
import { EyeCloseLine } from '@mingcute/react/eye-close'
import { LockLine } from '@mingcute/react/lock'
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { UnlockState } from '@/app/private/actions'
import {
  clearPrivateModeHint,
  getPrivateModeHint,
  notifyPrivateModeHintChange,
} from '@/lib/private'
import {
  clearPrivateLockout,
  endPrivateLockout,
  getPrivateLockout,
  getPrivateLockoutOnServer,
  recordFailedUnlock,
  subscribePrivateLockout,
} from '@/lib/private/lockout'
import { cn } from '@/lib/style'
import { LockedAlbumBackdrop } from './locked-album-backdrop'

interface PrivateUnlockProps {
  action: (state: UnlockState, formData: FormData) => Promise<UnlockState>
}

const initialState: UnlockState = { error: null }

const shakeKeyframes: Keyframe[] = [
  { transform: 'translateX(0)' },
  { transform: 'translateX(-6px)' },
  { transform: 'translateX(5px)' },
  { transform: 'translateX(-3px)' },
  { transform: 'translateX(0)' },
]

export function PrivateUnlock({ action }: PrivateUnlockProps) {
  const inputId = useId()
  const errorId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const fieldRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<SVGCircleElement>(null)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [hasPassword, setHasPassword] = useState(false)
  const lockout = useSyncExternalStore(
    subscribePrivateLockout,
    getPrivateLockout,
    getPrivateLockoutOnServer,
  )
  // Typing again dismisses the error of the attempt it belongs to.
  const [dismissedState, setDismissedState] = useState<UnlockState | null>(null)
  const [state, formAction, isPending] = useActionState(
    async (previous: UnlockState, formData: FormData) => {
      const next = await action(previous, formData)

      if (next.error) {
        recordFailedUnlock()
        // React resets the form after the action without firing onChange.
        setHasPassword(false)
      } else {
        clearPrivateLockout()
        notifyPrivateModeHintChange()
      }

      return next
    },
    initialState,
  )
  const error = isPending || dismissedState === state ? null : state.error
  const isLocked = lockout !== null

  // Reaching this form means the server rejected the session, so the icon must show locked.
  useEffect(() => {
    if (getPrivateModeHint()) {
      clearPrivateModeHint()
    }
  }, [])

  // A new state object per attempt, so this runs once per failure.
  useEffect(() => {
    if (!state.error) return

    inputRef.current?.focus()

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      fieldRef.current?.animate(shakeKeyframes, {
        duration: 320,
        easing: 'ease-out',
      })
    }
  }, [state])

  useEffect(() => {
    if (!lockout) return

    const remainingMs = Math.max(0, lockout.lockedUntil - Date.now())
    // A negative delay resumes the ring partway through after a reload.
    const animation = ringRef.current?.animate(
      [{ strokeDashoffset: 0 }, { strokeDashoffset: 1 }],
      {
        duration: lockout.durationMs,
        delay: remainingMs - lockout.durationMs,
        easing: 'linear',
        fill: 'forwards',
      },
    )
    const timeout = window.setTimeout(() => {
      endPrivateLockout()
      inputRef.current?.focus()
    }, remainingMs)

    return () => {
      animation?.cancel()
      window.clearTimeout(timeout)
    }
  }, [lockout])

  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden px-6 py-24">
      <LockedAlbumBackdrop />
      <div
        className="bg-base/40 absolute inset-0 bg-[radial-gradient(closest-side,var(--color-base)_30%,transparent)]"
        aria-hidden="true"
      />

      <form
        action={formAction}
        className="relative flex w-full max-w-72 flex-col items-center"
      >
        <h1 className="sr-only">Private</h1>
        {/* MingCute icons pin `color: currentColor` inline, so the colour goes on a wrapper. */}
        <span
          className={cn(
            'transition-colors duration-200',
            isLocked ? 'text-muted' : error ? 'text-love' : 'text-iris',
          )}
        >
          <LockLine className="size-7" aria-hidden="true" />
        </span>
        <div
          ref={fieldRef}
          className={cn(
            'bg-surface/80 mt-5 flex h-11 w-full items-center gap-1 rounded-full border py-1 pr-1 pl-4 backdrop-blur-md transition-[border-color,box-shadow] duration-150',
            isLocked
              ? 'border-overlay'
              : error
                ? 'border-love has-[input:focus-visible]:ring-love/20 has-[input:focus-visible]:ring-4'
                : 'border-overlay hover:border-muted/60 has-[input:focus-visible]:border-iris has-[input:focus-visible]:ring-iris/20 has-[input:focus-visible]:ring-4',
          )}
        >
          <label htmlFor={inputId} className="sr-only">
            Password
          </label>
          <input
            ref={inputRef}
            id={inputId}
            name="password"
            type={isPasswordVisible ? 'text' : 'password'}
            required
            autoFocus
            autoComplete="off"
            placeholder="Password"
            // Read-only rather than disabled, so focus stays in the field.
            readOnly={isLocked}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setHasPassword(event.target.value !== '')
              setDismissedState(state)
            }}
            className="text-text placeholder:text-muted h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <button
            type="button"
            disabled={isLocked}
            onClick={() => setIsPasswordVisible((visible) => !visible)}
            aria-controls={inputId}
            aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
            className="text-muted enabled:hover:bg-overlay enabled:hover:text-text flex size-8 shrink-0 items-center justify-center rounded-full transition-[color,background-color,opacity] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPasswordVisible ? (
              <EyeCloseLine className="size-4" aria-hidden="true" />
            ) : (
              <EyeLine className="size-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="submit"
            disabled={isPending || isLocked || !hasPassword}
            aria-label={
              isLocked ? 'Try again later' : isPending ? 'Unlocking' : 'Unlock'
            }
            className={cn(
              'relative flex size-9 shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform,opacity] duration-150 motion-reduce:transition-none',
              isLocked || !hasPassword
                ? 'bg-overlay text-muted cursor-not-allowed'
                : 'bg-iris text-surface hover:bg-iris/90 active:scale-95 disabled:cursor-wait disabled:opacity-70 motion-reduce:active:scale-100',
            )}
          >
            {isLocked && (
              <svg
                className="text-iris absolute inset-0 size-full -rotate-90"
                viewBox="0 0 36 36"
                aria-hidden="true"
              >
                <circle
                  ref={ringRef}
                  cx="18"
                  cy="18"
                  r="17"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray={1}
                />
              </svg>
            )}
            {isPending ? (
              <span
                className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
                aria-hidden="true"
              />
            ) : (
              <ArrowRightLine className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
        <p id={errorId} role="alert" className="sr-only">
          {error}
        </p>
      </form>
    </main>
  )
}
