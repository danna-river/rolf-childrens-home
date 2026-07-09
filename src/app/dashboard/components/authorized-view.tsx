"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BadgeCheckIcon,
  ChevronRightIcon,
  LogOutIcon,
  UserCircleIcon,
  UsersRoundIcon,
} from 'lucide-react'
import { signOutAction } from '@/app/login/actions'
import { updateUiLocale } from '@/app/dashboard/settings/actions/actions'
import { useLocale, useTranslations } from '@/i18n/client'
import type { Locale } from '@/i18n/config'

interface AuthorizedViewProps {
  email: string
  portalType: 'admin' | 'staff' | 'donor'
}

export function AuthorizedView({ email, portalType }: AuthorizedViewProps) {
  const router = useRouter()
  const t = useTranslations()
  const currentLocale = useLocale()
  const [loading, setLoading] = useState(false)
  const [locale, setLocale] = useState<Locale>(currentLocale)
  const [savingLocale, setSavingLocale] = useState(false)
  const [languageMessage, setLanguageMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const isDonorPortal = portalType === 'donor'
  const accountInitial = email.trim().charAt(0).toUpperCase() || '?'
  const identityTitle = t(
    portalType === 'admin'
      ? 'dashboard.portal.admin'
      : portalType === 'staff'
        ? 'dashboard.portal.staff'
        : 'dashboard.portal.donor',
  )
  const portalLabel = t(
    portalType === 'admin'
      ? 'dashboard.portal.adminLabel'
      : portalType === 'staff'
        ? 'dashboard.portal.staffLabel'
        : 'dashboard.portal.donorLabel',
  )
  const actionLabel = isDonorPortal
    ? t('dashboard.authorized.viewSponsoredChildren')
    : t('dashboard.authorized.openChildren')
  const actionHelper = isDonorPortal
    ? t('dashboard.authorized.viewSponsoredChildrenHelp')
    : t('dashboard.authorized.openChildrenHelp')

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
    <main className="google-sans-page flex min-h-[calc(100svh_-_4rem)] items-center justify-center bg-ice px-4 py-4 sm:py-8">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-stone bg-white shadow-sm">
        <div className="bg-navy px-5 py-4 text-white sm:px-6 sm:py-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-teal/40 bg-teal/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-teal sm:mb-4">
            <BadgeCheckIcon className="size-3.5" aria-hidden />
            {t('dashboard.authorized.badge')}
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            {t('dashboard.authorized.title')}
          </h1>
          <p className="mt-1 text-sm font-medium text-white/60 sm:text-base">{identityTitle}</p>
        </div>

        <div className="space-y-3 px-5 py-4 sm:space-y-4 sm:px-6 sm:py-6">
          <div className="rounded-xl border border-stone bg-ice px-4 py-3 sm:py-5">
            <div className="flex items-center gap-3 text-left sm:flex-col sm:text-center">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white sm:size-12 sm:text-base">
                {accountInitial}
              </div>
              <div className="w-full min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-navy/45">{t('dashboard.authorized.signedInAs')}</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-navy sm:mt-1 sm:text-base">{email}</p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-teal sm:mt-1.5 sm:text-sm">
                  <UserCircleIcon className="size-4" aria-hidden />
                  {portalLabel}
                </p>
              </div>
            </div>
          </div>

          {!isDonorPortal && (
            <section className="rounded-xl border border-stone bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold tracking-tight text-navy">{t('settings.language.title')}</h2>
                <p className="hidden text-xs font-medium text-navy/45 sm:block">{t('dashboard.language.settingsHint')}</p>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-stone bg-ice p-1">
                {(['en', 'fr'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleLocaleChange(option)}
                    disabled={savingLocale}
                    className={`min-h-9 rounded-lg px-3 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
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
                <p className={`mt-2 text-xs font-semibold ${languageMessage.type === 'success' ? 'text-teal' : 'text-rose-700'}`}>
                  {languageMessage.text}
                </p>
              )}
              <p className="mt-2 text-xs font-medium text-navy/45 sm:hidden">{t('dashboard.language.settingsHint')}</p>
            </section>
          )}

          <Link
            href="/dashboard/children"
            className="group flex w-full items-center justify-between gap-3 rounded-xl bg-navy px-4 py-3 text-left text-white transition-colors hover:bg-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy sm:gap-4 sm:py-4"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-teal">
                <UsersRoundIcon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold sm:text-base">{actionLabel}</span>
                <span className="mt-0.5 block text-xs font-medium text-white/55 sm:text-sm">{actionHelper}</span>
              </span>
            </span>
            <ChevronRightIcon
              className="size-5 shrink-0 text-white/45 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-stone px-5 py-3 sm:px-6 sm:py-4">
          <p className="text-xs font-medium text-navy/40">{t('dashboard.authorized.finished')}</p>
          <form action={signOutAction} onSubmit={() => setLoading(true)} className="shrink-0">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1 text-xs font-semibold text-navy/45 transition-colors hover:text-red-600 disabled:text-navy/20"
            >
              <LogOutIcon className="size-3.5" aria-hidden />
              {loading ? t('dashboard.authorized.signingOut') : t('menu.signOut')}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
