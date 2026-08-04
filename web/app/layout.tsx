import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import 'swiper/css'
import 'swiper/css/virtual'
import { siteConfig } from '@/lib/site-config'
import '@/styles/globals.css'
import { Header } from '@/components/header'

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
})

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#232136' },
    { media: '(prefers-color-scheme: light)', color: '#faf4ed' },
  ],
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
  category: 'Photo Gallery',
  keywords: 'Blog, Gallery, Photos, Lumine',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={geist.variable}>
      <body>
        <Header />
        {children}
      </body>
    </html>
  )
}
