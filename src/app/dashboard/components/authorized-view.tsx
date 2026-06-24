"use client"

import { useState } from 'react'
import Link from 'next/link'
import {
  BadgeCheckIcon,
  ChevronRightIcon,
  LogOutIcon,
  UserCircleIcon,
  UsersRoundIcon,
} from 'lucide-react'
import { signOutAction } from '@/app/login/actions'

interface AuthorizedViewProps {
  email: string
  identityTitle: string
}

export function AuthorizedView({ email, identityTitle }: AuthorizedViewProps) {
  const [loading, setLoading] = useState(false)
  const isDonorPortal = identityTitle.toLowerCase().includes('donor')
  const portalLabel = identityTitle.replace(/\s+portal$/i, '')
  const accountInitial = email.trim().charAt(0).toUpperCase() || '?'
  const actionLabel = isDonorPortal ? 'View Sponsored Children' : 'Open Children Registry'
  const actionHelper = isDonorPortal
    ? 'Follow the children connected to your donor account.'
    : 'Review records, updates, media, and child profile details.'

  return (
    <main className="google-sans-page flex min-h-[calc(100svh_-_4rem)] items-center justify-center bg-ice px-4 py-8">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-stone bg-white shadow-sm">
        <div className="bg-navy px-6 py-6 text-white">
          <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-teal/40 bg-teal/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-teal">
            <BadgeCheckIcon className="size-3.5" aria-hidden />
            Authorized
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Welcome back!
          </h1>
          <p className="mt-1 text-base font-medium text-white/60">{identityTitle}</p>
        </div>

        <div className="space-y-4 px-6 py-6">
          <div className="rounded-xl border border-stone bg-ice px-4 py-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-navy text-base font-bold text-white">
                {accountInitial}
              </div>
              <div className="w-full min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-navy/45">Signed in as</p>
                <p className="mt-1 text-base font-semibold text-navy">{email}</p>
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-teal">
                  <UserCircleIcon className="size-4" aria-hidden />
                  {portalLabel}
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/dashboard/children"
            className="group flex w-full items-center justify-between gap-4 rounded-xl bg-navy px-4 py-4 text-left text-white transition-colors hover:bg-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-teal">
                <UsersRoundIcon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-bold">{actionLabel}</span>
                <span className="mt-0.5 block text-sm font-medium text-white/55">{actionHelper}</span>
              </span>
            </span>
            <ChevronRightIcon
              className="size-5 shrink-0 text-white/45 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-stone px-6 py-4">
          <p className="text-xs font-medium text-navy/40">Finished for now?</p>
          <form action={signOutAction} onSubmit={() => setLoading(true)} className="shrink-0">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1 text-xs font-semibold text-navy/45 transition-colors hover:text-red-600 disabled:text-navy/20"
            >
              <LogOutIcon className="size-3.5" aria-hidden />
              {loading ? 'Signing out…' : 'Sign out'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
