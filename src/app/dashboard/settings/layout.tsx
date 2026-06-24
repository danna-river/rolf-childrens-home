// src/app/dashboard/settings/layout.tsx
import { requireAuth } from '@/lib/auth'
import { TabsNav } from '@/app/dashboard/settings/components/tabs-nav'
import Link from 'next/link'

export default async function SettingsModuleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile } = await requireAuth({ allowUnapproved: true })

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
              ← Return to Main Dashboard
            </Link>
          </div>
          <div>
            <h1 className="google-sans-registry-title text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Settings
            </h1>
            <p className="mt-2 text-base font-semibold text-white/55 sm:text-lg">
              Manage your profile settings, account authorizations, and global configurations.
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
              Settings Directory
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