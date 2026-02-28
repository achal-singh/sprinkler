'use client'

import { cn } from '@/lib/utils'

interface LoadingBarProps {
  isLoading: boolean
  className?: string
}

/**
 * A thin horizontal progress bar that appears at the very top of its
 * nearest positioned ancestor (use on a relative container, or the page body).
 * Mimics the GitHub / YouTube page-transition style.
 */
export function LoadingBar({ isLoading, className }: LoadingBarProps) {
  if (!isLoading) return null

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 z-50 h-[3px] overflow-hidden bg-blue-200/30 dark:bg-blue-900/30',
        className
      )}
      role="progressbar"
      aria-label="Loading"
    >
      <div className="h-full w-1/3 animate-loading-bar rounded-full bg-blue-600 dark:bg-blue-400" />
    </div>
  )
}
