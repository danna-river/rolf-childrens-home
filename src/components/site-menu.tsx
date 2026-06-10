"use client"

import Image from "next/image"
import Link from "next/link"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import {
  MenuIcon,
  XIcon,
  ChevronRightIcon,
  LogOutIcon,
  UserIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react"

import { signOutAction } from "@/app/login/actions"
import {
  isUnapprovedRole,
  isAdminRole,
  isStaffRole,
  isDonorRole,
} from "@/lib/profiles"

function roleLabel(role: string) {
  if (isAdminRole(role)) return "Administrator"
  if (isStaffRole(role)) return "Regional Staff"
  if (isDonorRole(role)) return "Donor"
  return "Pending Approval"
}

interface SiteMenuProps {
  email: string
  role: string
}

export function SiteMenu({ email, role }: SiteMenuProps) {
  const links = [
    // Children registry — hidden for users still awaiting approval.
    ...(isUnapprovedRole(role)
      ? []
      : [{ href: "/dashboard/children", label: "Children", icon: UsersIcon }]),
    { href: "/dashboard/settings?tab=profile", label: "Profile", icon: UserIcon },
    { href: "/dashboard/settings", label: "Settings", icon: SettingsIcon },
  ]

  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger
        aria-label="Open menu"
        className="flex size-10 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <MenuIcon className="size-6" aria-hidden="true" />
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-60 bg-navy/40 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed inset-0 z-60 flex flex-col bg-navy text-white outline-none duration-200 md:inset-y-0 md:right-0 md:left-auto md:w-96 md:max-w-[85vw] md:border-l md:border-white/10 md:shadow-2xl data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 max-md:data-open:slide-in-from-top-4 max-md:data-closed:slide-out-to-top-4 md:data-open:slide-in-from-right-8 md:data-closed:slide-out-to-right-8">
          {/* Menu header: logo + close, mirrors the navbar height */}
          <div className="flex h-16 shrink-0 items-center justify-between px-4 sm:px-6 lg:px-8">
            <Image
              src="/rolf-logo-white.png"
              alt="ROLF Children's Home"
              width={67}
              height={48}
              className="h-12 w-auto"
            />
            <DialogPrimitive.Close
              aria-label="Close menu"
              className="flex size-10 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <XIcon className="size-6" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          <DialogPrimitive.Title className="sr-only">
            Main menu
          </DialogPrimitive.Title>

          {/* Page links — each closes the menu on navigation */}
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
            {links.map(({ href, label, icon: Icon }) => (
              <DialogPrimitive.Close
                key={label}
                nativeButton={false}
                className="group flex items-center justify-between rounded-2xl px-4 py-4 text-2xl font-semibold transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                render={
                  <Link href={href}>
                    <span className="flex items-center gap-4">
                      <Icon className="size-6 text-teal" aria-hidden="true" />
                      {label}
                    </span>
                    <ChevronRightIcon
                      className="size-6 text-white/40 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                }
              />
            ))}
          </nav>

          {/* Footer: identity + sign out */}
          <div className="shrink-0 border-t border-white/15 px-4 py-5 sm:px-6 lg:px-8">
            <p className="truncate text-sm font-medium">{email}</p>
            <p className="text-xs text-white/60">{roleLabel(role)}</p>
            <form action={signOutAction} className="mt-4">
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
              >
                <LogOutIcon className="size-5" aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
