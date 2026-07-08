import { Suspense } from 'react'
import { requireAuth } from '@/lib/auth'
import { Navbar } from '@/components/navbar'
import { I18nProvider } from '@/i18n/client'
import { getMessages, getUserLocale } from '@/i18n/server'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Permissive gate: the navbar renders for every signed-in user (incl.
  // unapproved); per-page requireAuth calls still enforce their own rules.
  const { user, profile } = await requireAuth({ allowUnapproved: true })
  const locale = await getUserLocale(user.id)
  const messages = getMessages(locale)

  return (
    <I18nProvider locale={locale} messages={messages}>
      <div className="flex min-h-full flex-col">
        <Navbar email={user.email ?? ''} role={profile.role} />
        <Suspense>{children}</Suspense>
      </div>
    </I18nProvider>
  )
}
