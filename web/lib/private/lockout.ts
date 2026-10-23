// Per-browser cooldown for the unlock form. It only deters guessing by hand; the
// server-side rate limit is what stops scripts.
const STORAGE_KEY = 'private_lockout'
const LOCKOUT_THRESHOLD = 3
const BASE_LOCKOUT_MS = 30_000
const MAX_LOCKOUT_MS = 5 * 60_000

interface LockoutRecord {
  failedAttempts: number
  /** Lockouts so far; each one doubles the next, up to the cap. */
  lockoutCount: number
  /** Epoch milliseconds; 0 when not locked. */
  lockedUntil: number
  durationMs: number
}

interface PrivateLockout {
  lockedUntil: number
  durationMs: number
}

const emptyRecord: LockoutRecord = {
  failedAttempts: 0,
  lockoutCount: 0,
  lockedUntil: 0,
  durationMs: 0,
}

const listeners = new Set<() => void>()
let cachedRaw: string | null = null
let cachedLockout: PrivateLockout | null = null

function readRaw() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function readRecord(raw = readRaw()): LockoutRecord {
  if (!raw) return emptyRecord

  try {
    return { ...emptyRecord, ...(JSON.parse(raw) as Partial<LockoutRecord>) }
  } catch {
    return emptyRecord
  }
}

function writeRecord(record: LockoutRecord | null) {
  try {
    if (record) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Storage may be unavailable.
  }

  listeners.forEach((listener) => listener())
}

export function subscribePrivateLockout(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)

  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function getPrivateLockout() {
  const raw = readRaw()

  // useSyncExternalStore needs the same object back until the stored value changes.
  if (raw !== cachedRaw) {
    const { lockedUntil, durationMs } = readRecord(raw)

    cachedRaw = raw
    cachedLockout =
      lockedUntil > Date.now() ? { lockedUntil, durationMs } : null
  }

  return cachedLockout
}

export function getPrivateLockoutOnServer() {
  return null
}

export function recordFailedUnlock() {
  const record = readRecord()
  const failedAttempts = record.failedAttempts + 1

  if (failedAttempts < LOCKOUT_THRESHOLD) {
    writeRecord({ ...record, failedAttempts })
    return
  }

  const durationMs = Math.min(
    BASE_LOCKOUT_MS * 2 ** record.lockoutCount,
    MAX_LOCKOUT_MS,
  )

  writeRecord({
    failedAttempts: 0,
    lockoutCount: record.lockoutCount + 1,
    lockedUntil: Date.now() + durationMs,
    durationMs,
  })
}

/** Ends a finished lockout but keeps its count, so the next one is longer. */
export function endPrivateLockout() {
  writeRecord({ ...readRecord(), lockedUntil: 0, durationMs: 0 })
}

export function clearPrivateLockout() {
  writeRecord(null)
}
