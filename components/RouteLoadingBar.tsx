'use client'

import { Suspense, useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Inner component that uses useSearchParams (requires Suspense boundary).
 */
function RouteLoadingBarInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)

  // When pathname or searchParams change, the navigation has completed.
  useEffect(() => {
    setIsLoading(false)
  }, [pathname, searchParams])

  // Intercept all <a> clicks that trigger client-side navigation.
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

/**
 * A global route-change loading bar. Wraps the inner component in Suspense
 * as required by Next.js for components using useSearchParams.
 */
export function RouteLoadingBar() {
  return (
    <Suspense fallback={null}>
      <RouteLoadingBarInner />
    </Suspense>
  )
}
