// src/app/dashboard/settings/layout.tsx
import { requireAuth } from '@/lib/auth'
import { TabsNav } from '@/app/dashboard/settings/components/tabs-nav'
import Link from 'next/link'
import { getMessages, getUserLocale } from '@/i18n/server'
import type { MessageKey } from '@/i18n/locales/en'

export default async function SettingsModuleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, profile } = await requireAuth({ allowUnapproved: true })
  const locale = await getUserLocale(user.id)
  const messages = getMessages(locale)
  const t = (key: MessageKey) => messages[key]

  return (
    <div className="google-sans-registry min-h-[calc(100svh_-_4rem)] bg-ice/30 flex flex-col">
      {/* Persistent Workspace Header */}
      <section className="bg-navy text-white border-b border-stone">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white/55">
            <Link 
              href="/dashboard" 
              className="inline-flex min-h-8 items-center rounded-md border border-teal/40 bg-teal/15 px-3 text-xs font-bold uppercase tracking-widest text-teal hover:bg-teal/25 transition-colors"
            >
              ← {t('settings.header.returnDashboard')}
            </Link>
          </div>
          <div>
            <h1 className="google-sans-registry-title text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {t('settings.header.title')}
            </h1>
            <p className="mt-2 text-base font-semibold text-white/55 sm:text-lg">
              {t('settings.header.subtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* 2-Column Desktop Grid Layout */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
          
          {/* Navigation Sidebar Panel */}
          <div className="md:col-span-1 md:sticky md:top-6 space-y-2">
            <span className="hidden md:block text-[11px] font-medium uppercase tracking-[0.13em] text-navy/45 px-3">
              {t('settings.directory')}
            </span>
            <TabsNav userRole={profile.role} />
          </div>

          {/* Active Content Viewport */}
          <div className="md:col-span-3">
            {children}
          </div>

        </div>
      </main>
    </div>
  )
}
