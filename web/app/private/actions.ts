'use server'

import { refresh } from 'next/cache'
import { getPrivateConfig } from '@/lib/private/config'
import { isPrivatePassword, startPrivateSession } from '@/lib/private/session'

export interface UnlockState {
  error: string | null
}

// Slows down guessing; rate limiting itself belongs to the Vercel Firewall.
const FAILED_UNLOCK_DELAY_MS = 1000

export async function unlockPrivateMode(
  _state: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  const config = getPrivateConfig()
  const password = formData.get('password')

  if (!config) {
    return { error: 'Private mode is not available.' }
  }

  if (typeof password !== 'string' || !isPrivatePassword(config, password)) {
    await new Promise((resolve) => setTimeout(resolve, FAILED_UNLOCK_DELAY_MS))
    return { error: 'Incorrect password.' }
  }

  await startPrivateSession(config)
  refresh()

  return { error: null }
}
