import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import 'swiper/css'
import 'swiper/css/virtual'
import { siteConfig } from '@/lib/site-config'
import '@/styles/globals.css'
import { Header } from '@/components/header'
import { PageScrollArea } from '@/components/scroll-area'

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
})

export const viewport: Viewport = {
  themeColor: '#232136',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.title}`,
  },
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
    <html lang="en" className={geist.variable}>
      <body>
        <Header />
        <PageScrollArea>{children}</PageScrollArea>
      </body>
    </html>
  )
}
