'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * A global route-change loading bar that appears at the top of the viewport
 * whenever a Next.js client-side navigation is in progress.
 */
export function RouteLoadingBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)

  // When pathname or searchParams change, the navigation has completed.
  // We set isLoading to false to hide the bar.
  useEffect(() => {
    setIsLoading(false)
  }, [pathname, searchParams])

  // Intercept all <a> clicks that trigger client-side navigation.
  // When a link is clicked and it points to a different route, show the bar.
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href) return

      // Skip external links, hash links, and same-page links
      if (
        href.startsWith('http') ||
        href.startsWith('#') ||
        href === pathname
      ) {
        return
      }

      // This is an internal navigation — show the loading bar
      setIsLoading(true)
    }

    document.addEventListener('click', handleClick, { capture: true })
    return () => document.removeEventListener('click', handleClick, { capture: true })
  }, [pathname])

  if (!isLoading) return null

  return (
    <div
      className="fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden bg-blue-200/30 dark:bg-blue-900/30"
      role="progressbar"
      aria-label="Navigating"
    >
      <div className="h-full w-1/3 animate-loading-bar rounded-full bg-blue-600 dark:bg-blue-400" />
    </div>
  )
}
