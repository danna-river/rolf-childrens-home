"use client"

import { useState } from 'react'
import { loginAction } from '@/app/login/actions'
import { useTranslations } from '@/i18n/client'

interface LoginFormProps {
  onSwitchToRegister: () => void
}

export function LoginForm({ onSwitchToRegister }: LoginFormProps) {
  const t = useTranslations()
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
        <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-600">
          {errorMsg}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-[11px] font-bold uppercase tracking-widest text-navy/45">
          {t('login.email')}
        </label>
        <input
          name="email"
          type="email"
          required
          placeholder={t('login.emailPlaceholder')}
          className="w-full rounded-xl border border-stone bg-ice px-3 py-2 text-sm text-navy outline-none transition-all placeholder:text-navy/25 focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/20"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-bold uppercase tracking-widest text-navy/45">
          {t('login.password')}
        </label>
        <input
          name="password"
          type="password"
          required
          placeholder={t('login.passwordPlaceholder')}
          className="w-full rounded-xl border border-stone bg-ice px-3 py-2 text-sm text-navy outline-none transition-all placeholder:text-navy/25 focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/20"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full cursor-pointer rounded-xl bg-navy py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
      >
        {loading ? t('login.signIn.signingIn') : t('login.signIn.submit')}
      </button>

      <div className="pt-1 text-center">
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="cursor-pointer text-xs font-medium text-navy/40 transition-colors hover:text-teal"
        >
          {t('login.signIn.needAccount')}
        </button>
      </div>
    </form>
  )
}
