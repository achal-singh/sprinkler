import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/lib/contexts/ThemeContext'
import ThemeToggle from '@/components/ThemeToggle'

export const metadata: Metadata = {
  title: 'Sprinkler - Web3 Workshop Platform',
  description:
    'Interactive Web3 workshops with real-time collaboration and milestone tracking'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-white dark:bg-black text-gray-900 dark:text-gray-100">
        <ThemeProvider>
          <ThemeToggle />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
