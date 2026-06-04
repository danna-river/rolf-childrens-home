"use client"

import { useState } from 'react'
import { signOutAction } from '@/app/login/actions'

interface UnapprovedViewProps {
  email: string
}

export function UnapprovedView({ email }: UnapprovedViewProps) {
  const [loading, setLoading] = useState(false)

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-xs max-w-sm w-full text-center space-y-6">
        
        <div className="mx-auto w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 text-xl animate-pulse">
          ⏳
        </div>

        <div className="space-y-2">
          <h1 className="text-base font-bold text-gray-900 tracking-tight">
            Account Access Pending Approval
          </h1>
          <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
            Your credentials have been successfully registered, but your profile has not been assigned an active workstation role yet.
          </p>
          <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed pt-1">
            An administrator has been notified and must authorize your account before you can proceed.
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 text-[10px] font-mono text-gray-400 border border-gray-100">
          Authenticated Identity: <span className="font-semibold text-gray-600">{email}</span>
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