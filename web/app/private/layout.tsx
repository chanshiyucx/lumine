import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Private',
  robots: { index: false, follow: false },
}

export default function PrivateLayout({ children }: LayoutProps<'/private'>) {
  return children
}
