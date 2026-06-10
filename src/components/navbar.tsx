import Image from 'next/image'
import Link from 'next/link'

import { SiteMenu } from '@/components/site-menu'

interface NavbarProps {
  email: string
  role: string
}

/**
 * Universal top navigation bar shown across the authenticated dashboard.
 * Sticky on all viewports, ROLF teal-blue background. Holds only the menu
 * trigger (three lines) and the white logo; the SiteMenu opens a full-page
 * overlay with the page links (Children / Profile / Settings) + sign out.
 */
export function Navbar({ email, role }: NavbarProps) {
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

        <SiteMenu email={email} role={role} />
      </nav>
    </header>
  )
}
