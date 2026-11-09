import 'server-only'
import {
  MEDIA_SIGNING_SECRET_ENV,
  PRIVATE_ACCESS_PASSWORD_ENV,
  PRIVATE_MANIFEST_TOKEN_ENV,
  PRIVATE_MEDIA_ORIGIN_ENV,
  PRIVATE_SESSION_SECRET_ENV,
} from '@/lib/env'

export interface PrivateConfig {
  password: string
  sessionSecret: string
  /** Origin of the private media Worker; it serves assets at its root. */
  mediaOrigin: string
  /** Shared with the Worker, which verifies the asset URL signatures. */
  signingSecret: string
  /** Shared with the Worker, which serves the private manifest only with it. */
  manifestToken: string
}

const PRIVATE_ENV = {
  password: PRIVATE_ACCESS_PASSWORD_ENV,
  sessionSecret: PRIVATE_SESSION_SECRET_ENV,
  mediaOrigin: PRIVATE_MEDIA_ORIGIN_ENV,
  signingSecret: MEDIA_SIGNING_SECRET_ENV,
  manifestToken: PRIVATE_MANIFEST_TOKEN_ENV,
} satisfies Record<keyof PrivateConfig, string>

type PrivateEnvValues = Record<keyof PrivateConfig, string | undefined>

let hasWarned = false

/**
 * Returns null when private mode is not fully or validly configured, which
 * disables it rather than breaking every page that checks it.
 */
export function getPrivateConfig(): PrivateConfig | null {
  const values: PrivateEnvValues = {
    password: process.env[PRIVATE_ENV.password],
    sessionSecret: process.env[PRIVATE_ENV.sessionSecret],
    mediaOrigin: process.env[PRIVATE_ENV.mediaOrigin],
    signingSecret: process.env[PRIVATE_ENV.signingSecret],
    manifestToken: process.env[PRIVATE_ENV.manifestToken],
  }

  if (!isComplete(values)) {
    warnIfPartiallyConfigured()
    return null
  }

  const mediaOrigin = parseOrigin(values.mediaOrigin)

  if (!mediaOrigin) {
    warnOnce(
      `Private mode is disabled; ${PRIVATE_ENV.mediaOrigin} is not a valid URL.`,
    )
    return null
  }

  return { ...values, mediaOrigin }
}

function isComplete(values: PrivateEnvValues): values is PrivateConfig {
  return Object.values(values).every(Boolean)
}

// Without a scheme, a value like `localhost:8787` still parses, but its origin
// is the string 'null'.
function parseOrigin(value: string) {
  try {
    const { origin } = new URL(value)
    return origin === 'null' ? null : origin
  } catch {
    return null
  }
}

// Some but not all variables set is most likely a mistake; none set means the
// mode is simply off.
function warnIfPartiallyConfigured() {
  const names = Object.values(PRIVATE_ENV)
  const missing = names.filter((name) => !process.env[name])

  if (missing.length < names.length) {
    warnOnce(`Private mode is disabled; missing ${missing.join(', ')}.`)
  }
}

function warnOnce(message: string) {
  if (hasWarned) return

  hasWarned = true
  console.warn(message)
}
