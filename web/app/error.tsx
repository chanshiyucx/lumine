'use client'

import { useEffect } from 'react'
import { Space } from '@/components/icons/space'

export default function Error({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="grid min-h-svh place-items-center px-6 py-24">
      <div className="relative isolate max-w-md text-center">
        <Space width="20rem" height="20rem" />
        <p>500 | Something went wrong.</p>
      </div>
    </main>
  )
}
