import type { Metadata } from 'next'
import { AlbumsPage } from '@/components/albums'

export const metadata: Metadata = {
  title: 'Albums',
}

export default function Page() {
  return <AlbumsPage />
}
