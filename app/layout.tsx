import type { Metadata } from 'next'
import { Cormorant_Garamond, Geist_Mono, Manrope } from 'next/font/google'
import { siteConfig } from '@/lib/site-config'
import { cn } from '@/lib/utils'
import './globals.css'

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
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
        manrope.variable,
        geistMono.variable,
        cormorant.variable,
        'h-full antialiased',
      )}
    >
      <body
        className={cn('bg-background text-foreground flex min-h-full flex-col')}
      >
        {children}
      </body>
    </html>
  )
}
