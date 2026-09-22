import { Space } from '@/components/icons/space'

export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center px-6 py-24">
      <div className="relative isolate max-w-md text-center">
        <Space width="20rem" height="20rem" />
        <p>404 | This page could not be found.</p>
      </div>
    </main>
  )
}
