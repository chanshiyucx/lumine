// Client-readable hint that this browser holds a private session. It only drives the
// header icon; the server never trusts it and checks the signed session cookie instead.
export const PRIVATE_MODE_HINT_COOKIE = 'lumine_private_mode'

const listeners = new Set<() => void>()

export function subscribePrivateModeHint(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function getPrivateModeHint() {
  return document.cookie.split('; ').includes(`${PRIVATE_MODE_HINT_COOKIE}=1`)
}

export function getPrivateModeHintOnServer() {
  return false
}

export function notifyPrivateModeHintChange() {
  listeners.forEach((listener) => listener())
}

/** Drops a hint left behind by a session the server no longer accepts. */
export function clearPrivateModeHint() {
  document.cookie = `${PRIVATE_MODE_HINT_COOKIE}=; Max-Age=0; Path=/`
  notifyPrivateModeHintChange()
}
