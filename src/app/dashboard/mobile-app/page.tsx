import { redirect } from 'next/navigation'
import { DownloadIcon, RefreshCwIcon, ShieldCheckIcon, SmartphoneIcon } from 'lucide-react'
import { requireAuth } from '@/lib/auth'
import { MOBILE_APP_DOWNLOAD_ROUTE, mobileAppRelease } from '@/lib/mobile-app-release'
import { isAdminRole, isStaffRole } from '@/lib/profiles'
import { getMessages, getUserLocale } from '@/i18n/server'
import type { MessageKey } from '@/i18n/locales/en'

export default async function MobileAppPage() {
  const { user, profile } = await requireAuth()

  if (!isAdminRole(profile.role) && !isStaffRole(profile.role)) {
    redirect('/dashboard')
  }

  const locale = await getUserLocale(user.id)
  const messages = getMessages(locale)
  const t = (key: MessageKey) => messages[key]
  const version = mobileAppRelease.versionName
    ? mobileAppRelease.versionCode
      ? `${mobileAppRelease.versionName} (${t('mobileApp.build')} ${mobileAppRelease.versionCode})`
      : mobileAppRelease.versionName
    : t('mobileApp.notConfigured')

  const details = [
    { label: t('mobileApp.latestVersion'), value: version },
    { label: t('mobileApp.releaseDate'), value: mobileAppRelease.releaseDate ?? t('mobileApp.notConfigured') },
    { label: t('mobileApp.requirement'), value: mobileAppRelease.minAndroidVersion },
    { label: t('mobileApp.connection'), value: t('mobileApp.wifiRequired') },
  ]
  const downloadButtonClassName =
    'items-center justify-center gap-2 rounded-lg bg-teal px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-teal/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal'

  return (
    <main className="flex flex-1 flex-col bg-ice px-4 py-8 google-sans-page text-navy sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="flex flex-col gap-5 border-b border-stone pb-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-teal/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-teal">
              <SmartphoneIcon className="size-4" aria-hidden="true" />
              {t('mobileApp.badge')}
            </p>
            <h1 className="google-sans-registry-title text-4xl font-bold tracking-normal text-navy sm:text-5xl">
              {t('mobileApp.title')}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-navy/70">
              {t('mobileApp.blurb')}
            </p>
          </div>
          <a
            href={MOBILE_APP_DOWNLOAD_ROUTE}
            className={`hidden ${downloadButtonClassName} md:inline-flex`}
          >
            <DownloadIcon className="size-5" aria-hidden="true" />
            {t('mobileApp.download')}
          </a>
        </section>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {details.map((item) => (
            <div key={item.label} className="rounded-lg border border-stone bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-navy/45">{item.label}</p>
              <p className="mt-2 text-xl font-bold text-navy">{item.value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
          <div className="rounded-lg border border-stone bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <ShieldCheckIcon className="mt-1 size-5 shrink-0 text-teal" aria-hidden="true" />
              <div>
                <h2 className="text-xl font-bold text-navy">{t('mobileApp.installTitle')}</h2>
                <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-navy/70">
                  <li>{t('mobileApp.installStep1')}</li>
                  <li>{t('mobileApp.installStep2')}</li>
                  <li>{t('mobileApp.installStep3')}</li>
                  <li>{t('mobileApp.installStep4')}</li>
                </ol>
              </div>
            </div>
          </div>

          <aside className="rounded-lg border border-stone bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <RefreshCwIcon className="mt-1 size-5 shrink-0 text-teal" aria-hidden="true" />
              <div>
                <h2 className="text-xl font-bold text-navy">{t('mobileApp.syncTitle')}</h2>
                <p className="mt-4 text-sm leading-6 text-navy/70">
                  {t('mobileApp.syncDescription')}
                </p>
              </div>
            </div>
          </aside>
        </section>

        <a
          href={MOBILE_APP_DOWNLOAD_ROUTE}
          className={`inline-flex ${downloadButtonClassName} md:hidden`}
        >
          <DownloadIcon className="size-5" aria-hidden="true" />
          {t('mobileApp.download')}
        </a>
      </div>
    </main>
  )
}
