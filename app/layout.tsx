import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { siteConfig } from '@/lib/site-config'
import { cn } from '@/lib/utils'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang={siteConfig.locale}
      className={cn(
        geistSans.variable,
        geistMono.variable,
        'h-full antialiased',
      )}
    >
      <body className={cn('flex min-h-full flex-col')}>{children}</body>
    </html>
  )
}
