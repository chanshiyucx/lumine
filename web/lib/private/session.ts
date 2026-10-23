import 'server-only'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { PRIVATE_MODE_HINT_COOKIE } from '.'
import type { PrivateConfig } from './config'

const SESSION_COOKIE = 'lumine_private_session'
const SESSION_SECONDS = 3 * 24 * 60 * 60
const SESSION_PATTERN = /^(\d{1,12})\.([\w-]{43})$/

export interface PrivateSession {
  /** Unix seconds; private asset links are signed until then. */
  expiresAt: number
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest()
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

// Binding the password hash means changing the password ends every session.
function signSession(config: PrivateConfig, expiresAt: number) {
  return createHmac('sha256', config.sessionSecret)
    .update(`${expiresAt}.${sha256(config.password).toString('base64url')}`)
    .digest('base64url')
}

export function isPrivatePassword(config: PrivateConfig, input: string) {
  return timingSafeEqual(sha256(input), sha256(config.password))
}

export async function getPrivateSession(
  config: PrivateConfig,
): Promise<PrivateSession | null> {
  const match = SESSION_PATTERN.exec(
    (await cookies()).get(SESSION_COOKIE)?.value ?? '',
  )

  if (!match) {
    return null
  }

  const expiresAt = Number(match[1])
  const now = nowSeconds()

  if (expiresAt <= now || expiresAt > now + SESSION_SECONDS) {
    return null
  }

  const actual = Buffer.from(match[2])
  const expected = Buffer.from(signSession(config, expiresAt))

  return timingSafeEqual(actual, expected) ? { expiresAt } : null
}

/** Starts a fixed three-day session; revisiting does not extend it. */
export async function startPrivateSession(config: PrivateConfig) {
  const expiresAt = nowSeconds() + SESSION_SECONDS
  const cookieStore = await cookies()
  const options = {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_SECONDS,
  } as const

  cookieStore.set(
    SESSION_COOKIE,
    `${expiresAt}.${signSession(config, expiresAt)}`,
    { ...options, httpOnly: true },
  )
  cookieStore.set(PRIVATE_MODE_HINT_COOKIE, '1', options)
}
