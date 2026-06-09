import { requireAuth } from '@/lib/auth'
import { TabsNav } from '@/app/dashboard/settings/components/tabs-nav'
import Link from 'next/link'

export default async function SettingsModuleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 🛡️ Global entry guard: Fail fast if the user doesn't have an active login session
  const { profile } = await requireAuth({ allowUnapproved: true })

  return (
    <main className="min-h-screen bg-gray-50 p-6 sm:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Persistent Workspace Header */}
        <div>
          <Link href="/dashboard" className="text-xs text-blue-600 hover:underline font-medium">
            ← Return to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mt-1">
            Settings
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Manage your profile settings, account authorizations, and global configurations.
          </p>
        </div>

        {/* Interactive Tab Controller Navigation Strip */}
        <TabsNav userRole={profile.role} />

        {/* Inner Tab View Context Container */}
        <div className="pt-2">
          {children}
        </div>

      </div>
    </main>
  )
}