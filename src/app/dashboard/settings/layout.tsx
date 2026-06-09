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
    <main className="min-h-screen bg-gray-50 p-4 sm:p-8 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Persistent Workspace Header */}
        <div className="border-b border-gray-100 pb-4">
          <Link href="/dashboard" className="text-xs text-blue-600 hover:underline font-medium">
            ← Return to Main Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mt-1">
            Settings
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
          Manage your profile settings, account authorizations, and global configurations.
          </p>
        </div>

        {/* 🌟 2-Column Desktop Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
          
          {/* Left Column: Navigation Sidebar Panel */}
          <div className="md:col-span-1 md:sticky md:top-6">
            <span className="hidden md:block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3 px-4">
              Settings Directory
            </span>
            <TabsNav userRole={profile.role} />
          </div>

          {/* Right Column: Active Content Viewport */}
          <div className="md:col-span-3">
            {children}
          </div>

        </div>

      </div>
    </main>
  )
}