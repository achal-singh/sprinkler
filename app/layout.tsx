import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Playfair_Display, Sora } from 'next/font/google'
import './globals.css'
import '@rainbow-me/rainbowkit/styles.css'
import { ThemeProvider } from '@/lib/contexts/ThemeContext'
import { Providers } from '@/components/Providers'
import ThemeToggle from '@/components/ThemeToggle'
import { RouteLoadingBar } from '@/components/RouteLoadingBar'

export const metadata: Metadata = {
  title: 'Sprinkler - Web3 Workshop Platform',
  description:
    'Interactive Web3 workshops with real-time collaboration and milestone tracking'
}

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap'
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap'
})

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sora.variable} ${playfair.variable} antialiased bg-transparent text-gray-900 dark:text-gray-100`}
      >
        <ThemeProvider>
          <Providers>
            <Suspense fallback={null}>
              <RouteLoadingBar />
            </Suspense>
            <ThemeToggle />
            {children}
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
