'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfileName, updateUiLocale } from '../actions/actions'
import { useTranslations } from '@/i18n/client'
import type { Locale } from '@/i18n/config'

interface ProfileViewProps {
  initialName?: string
  email?: string
  initialLocale?: Locale
  isDonor?: boolean
}

export function ProfileView({ initialName = '', email = '', initialLocale = 'en', isDonor = false }: ProfileViewProps) {
  const router = useRouter()
  const t = useTranslations()
  const [name, setName] = useState(initialName)
  const [locale, setLocale] = useState<Locale>(initialLocale)
  const [loading, setLoading] = useState(false)
  const [savingLocale, setSavingLocale] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [languageMessage, setLanguageMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const result = await updateProfileName(name)
    setLoading(false)

    if (result.success) {
      setMessage({ type: 'success', text: t('settings.profile.nameSaved') })
    } else {
      setMessage({ type: 'error', text: result.error || t('settings.profile.nameError') })
    }
  }

  const handleLocaleChange = async (nextLocale: Locale) => {
    if (nextLocale === locale || savingLocale) return

    setSavingLocale(true)
    setLanguageMessage(null)

    const previousLocale = locale
    setLocale(nextLocale)
    const result = await updateUiLocale(nextLocale)
    setSavingLocale(false)

    if (result.success) {
      setLanguageMessage({ type: 'success', text: t('settings.language.saved') })
      router.refresh()
    } else {
      setLocale(previousLocale)
      setLanguageMessage({ type: 'error', text: result.error || t('settings.language.error') })
    }
  }

  return (
    <div className="google-sans-registry max-w-md space-y-4">
      {!isDonor && (
        <section className="rounded-md border border-stone bg-white p-5 shadow-sm sm:p-6">
          <div className="border-b border-stone pb-3">
            <h3 className="text-base font-bold tracking-tight text-navy sm:text-lg">{t('settings.language.title')}</h3>
            <p className="mt-0.5 text-xs font-medium leading-5 text-navy/55">{t('settings.language.description')}</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-stone bg-ice p-1">
            {(['en', 'fr'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleLocaleChange(option)}
                disabled={savingLocale}
                className={`min-h-10 rounded-lg px-3 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  locale === option
                    ? 'bg-navy text-white shadow-sm'
                    : 'text-navy/60 hover:bg-white hover:text-navy'
                }`}
              >
                {option === 'en' ? t('settings.language.english') : t('settings.language.french')}
              </button>
            ))}
          </div>

          {languageMessage && (
            <p className={`mt-3 text-xs font-semibold ${languageMessage.type === 'success' ? 'text-teal' : 'text-rose-700'}`}>
              {languageMessage.text}
            </p>
          )}
        </section>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-md border border-stone bg-white p-5 shadow-sm sm:p-6">
        <div className="border-b border-stone pb-3">
          <h3 className="text-base font-bold tracking-tight text-navy sm:text-lg">{t('settings.profile.title')}</h3>
          <p className="mt-0.5 text-xs font-medium text-navy/55">{t('settings.profile.description')}</p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium uppercase tracking-[0.13em] text-navy/45">{t('settings.profile.email')}</label>
          <input
            type="text"
            disabled
            value={email}
            className="w-full cursor-not-allowed rounded-md border border-stone bg-ice/60 px-3 py-2 font-mono text-xs text-navy/50 outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium uppercase tracking-[0.13em] text-navy/45">{t('settings.profile.fullName')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-stone bg-white px-3 py-2 text-xs font-semibold text-navy transition-colors placeholder:font-normal placeholder:text-navy/30 focus:border-teal focus:outline-none"
            placeholder={t('settings.profile.fullNamePlaceholder')}
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
          disabled={loading || name.trim() === initialName.trim()}
          className="w-full cursor-pointer rounded-md bg-teal py-2.5 text-xs font-bold text-white shadow-2xs transition-all hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? t('settings.profile.saving') : t('settings.profile.updateName')}
        </button>
      </form>
    </div>
  )
}
