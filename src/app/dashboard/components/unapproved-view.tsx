"use client"

import { useState } from 'react'
import { ClockIcon } from 'lucide-react'
import { signOutAction } from '@/app/login/actions'

interface UnapprovedViewProps {
  email: string
}

export function UnapprovedView({ email }: UnapprovedViewProps) {
  const [loading, setLoading] = useState(false)
  const accountInitial = email.trim().charAt(0).toUpperCase() || '?'

  return (
    <main className="google-sans-page flex min-h-[calc(100svh_-_4rem)] items-center justify-center bg-ice px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-stone bg-white shadow-sm">

        <div className="bg-navy px-6 py-5 text-white">
          <div className="mb-3 inline-flex items-center rounded-md border border-amber-400/30 bg-amber-400/12 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-400">
            Pending Approval
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Account access pending
          </h1>
          <p className="mt-0.5 text-sm font-medium text-white/55">
            Awaiting administrator authorization
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex items-start gap-3 text-sm leading-relaxed text-navy/60">
            <ClockIcon className="mt-0.5 size-4 shrink-0 text-navy/35" aria-hidden />
            <p>
              Your credentials were registered successfully. An administrator must assign you
              a role before you can access the dashboard.
            </p>
          </div>

          <div className="rounded-xl border border-stone bg-ice px-4 py-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-navy text-base font-bold text-white">
                {accountInitial}
              </div>
              <div className="w-full min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-navy/45">Signed in as</p>
                <p className="mt-1 text-base font-semibold text-navy">{email}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-stone px-6 pb-5 pt-4">
          <form action={signOutAction} onSubmit={() => setLoading(true)}>
            <button
              type="submit"
              disabled={loading}
              className="cursor-pointer text-xs font-medium text-navy/40 transition-colors hover:text-red-600 disabled:text-navy/20"
            >
              {loading ? 'Signing out…' : 'Sign out'}
            </button>
          </form>
        </div>

      </div>
    </main>
  )
}
