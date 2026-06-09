import Image from 'next/image'
import Link from 'next/link'
import { Settings } from 'lucide-react'

/**
 * Universal top navigation bar shown across the authenticated dashboard.
 * Sticky on all viewports, ROLF teal-blue background with the white logo,
 * and a Settings entry point available to every user (incl. unapproved).
 */
export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full bg-teal shadow-sm">
      <nav className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          aria-label="ROLF Children's Home — Dashboard"
          className="flex items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Image
            src="/rolf-logo-white.png"
            alt="ROLF Children's Home"
            width={67}
            height={48}
            preload
            className="h-12 w-auto"
          />
        </Link>

        <Link
          href="/dashboard/settings"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Settings className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">Settings</span>
        </Link>
      </nav>
    </header>
  )
}
