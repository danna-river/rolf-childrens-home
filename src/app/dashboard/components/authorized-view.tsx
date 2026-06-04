"use client"

import { useState } from 'react'
import Link from 'next/link'
import { signOutAction } from '@/app/login/actions'

interface AuthorizedViewProps {
  email: string
  identityTitle: string
}

export function AuthorizedView({ email, identityTitle }: AuthorizedViewProps) {
  const [loading, setLoading] = useState(false)

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-xs max-w-sm w-full text-center space-y-6">
        
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">
            Authorized Account
          </span>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight mt-4">
            Welcome Back
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Logged in as <span className="font-medium text-gray-700">{email}</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
            Role: {identityTitle}
          </p>
        </div>

        <div className="border-t border-gray-50 pt-4">
          <Link
            href="/dashboard/children"
            className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 rounded-xl shadow-xs transition-all active:scale-98 cursor-pointer"
          >
            Go to Children Dashboard →
          </Link>
        </div>

        <form action= {signOutAction} onSubmit={() => setLoading(true)}>
          <button
            type="submit"
            disabled={loading}
            className="text-[11px] text-gray-400 hover:text-red-600 transition-colors cursor-pointer font-medium disabled:text-gray-300"
          >
            {loading ? 'Signing out...' : 'Sign Out'}
          </button>
        </form>

      </div>
    </main>
  )
}