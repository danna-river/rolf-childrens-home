"use client"

import { useState } from 'react'
import { loginAction } from '@/app/login/actions'

export function LoginForm() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMsg(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    
    const result = await loginAction(formData)
    
    if (result?.error) {
      setErrorMsg(result.error)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-xl">
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Email Address
        </label>
        <input
          name="email"
          type="email"
          required
          placeholder="example@email.com"
          className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Password
        </label>
        <input
          name="password"
          type="password"
          required
          placeholder="••••••••••••••••"
          className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-xs py-2.5 rounded-xl shadow-xs transition-all active:scale-98 cursor-pointer"
      >
        {loading ? 'Authenticating...' : 'Sign In'}
      </button>
    </form>
  )
}