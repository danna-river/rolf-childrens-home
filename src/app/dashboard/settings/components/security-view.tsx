'use client'

import { useState } from 'react'
import { updateAccountPassword } from '../actions/actions'
import { useTranslations } from '@/i18n/client'

export function SecurityView() {
  const t = useTranslations()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (password !== confirmPassword) {
      return setMessage({ type: 'error', text: t('settings.security.passwordsMismatch') })
    }

    setLoading(true)
    const result = await updateAccountPassword(password)
    setLoading(false)

    if (result.success) {
      setMessage({ type: 'success', text: t('settings.security.passwordUpdated') })
      setPassword('')
      setConfirmPassword('')
    } else {
      setMessage({ type: 'error', text: result.error || t('settings.security.passwordError') })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="google-sans-registry p-5 sm:p-6 bg-white rounded-md border border-stone space-y-4 max-w-md shadow-sm">
      <div className="border-b border-stone pb-3">
        <h3 className="text-base font-bold tracking-tight text-navy sm:text-lg">{t('settings.security.title')}</h3>
        <p className="text-xs font-medium text-navy/55 mt-0.5">{t('settings.security.description')}</p>
      </div>

      <div className="space-y-1.5">
        <label className="block text-[11px] font-medium uppercase tracking-[0.13em] text-navy/45">{t('settings.security.newPassword')}</label>
        <input 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          className="font-semibold w-full text-xs px-3 py-2 bg-white border border-stone rounded-md text-navy placeholder:text-navy/30 placeholder:font-normal focus:border-teal focus:outline-none transition-colors"
          placeholder={t('settings.security.newPasswordPlaceholder')}
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-[11px] font-medium uppercase tracking-[0.13em] text-navy/45">{t('settings.security.confirmPassword')}</label>
        <input 
          type="password" 
          value={confirmPassword} 
          onChange={(e) => setConfirmPassword(e.target.value)} 
          className="font-semibold w-full text-xs px-3 py-2 bg-white border border-stone rounded-md text-navy placeholder:text-navy/30 placeholder:font-normal focus:border-teal focus:outline-none transition-colors"
          placeholder={t('settings.security.confirmPasswordPlaceholder')}
          required
        />
      </div>

      {message && (
        <p className={`text-xs font-semibold ${message.type === 'success' ? 'text-teal' : 'text-rose-700'}`}>
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !password || !confirmPassword}
        className="w-full py-2.5 bg-teal hover:bg-teal/90 text-white font-bold rounded-md text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
      >
        {loading ? t('settings.security.updating') : t('settings.security.changePassword')}
      </button>
    </form>
  )
}
