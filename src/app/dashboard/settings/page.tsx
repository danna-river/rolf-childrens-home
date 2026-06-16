import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isAdminRole } from '@/lib/profiles'

// View components imports
import { AccountApprovalView } from '@/app/dashboard/settings/components/admin/account-approval-view'
import { GlobalConfigsView } from '@/app/dashboard/settings/components/admin/global-configs-view'
import { AccountManagementView } from '@/app/dashboard/settings/components/admin/account-management-view'

// Temporary UI placeholders for your personal profile/security tabs
function ProfilePlaceholderForm() { 
  return <div className="p-6 bg-white rounded-2xl border border-gray-100 text-xs text-gray-400">👤 Profile settings editing coming soon.</div> 
}
function SecurityPlaceholderForm() { 
  return <div className="p-6 bg-white rounded-2xl border border-gray-100 text-xs text-gray-400">🔒 Account authentication and password reset fields coming soon.</div> 
}

type SettingsPageProps = {
  searchParams: Promise<{ tab?: string }>
}

export default async function SettingsTabDispatcherPage({ searchParams }: SettingsPageProps) {
  // 1. Run the auth check to load active user profile metrics safely on the server
  const { user, profile } = await requireAuth({ allowUnapproved: true })
  
  const resolvedParams = await searchParams
  const targetTab = resolvedParams.tab || 'profile'
  const isSystemAdmin = isAdminRole(profile.role)

  const supabase = await createClient()

  // 2. DISPATCHER PATTERN: Match conditions sequentially to isolate view blocks
  if (targetTab === 'approvals') {
    if (!isSystemAdmin) redirect('/dashboard/settings?tab=profile') // Anti-tamper role gate

    // Fetch unapproved accounts query payload
    const { data: pendingUsers } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, country, created_at')
      .eq('role', 'unapproved')
      .order('created_at', { ascending: false })

    // Fetch global configuration settings
    const { data: settingsData } = await supabase.from('app_settings').select('countries').eq('id', 1).single()
    const activeCountries = settingsData?.countries || []

    return (
      <AccountApprovalView 
        initialUsers={pendingUsers || []} 
        availableCountries={activeCountries} 
      />
    )
  }

  if (targetTab === 'manage_users') {
    if (!isSystemAdmin) redirect('/dashboard/settings?tab=profile') // Anti-tamper role gate
    const { data: accounts } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, country, created_at')
    .in('role', ['admin', 'staff', 'donor'])   // exclude 'unapproved' (that's the Approvals tab)
    .order('role', { ascending: true })
    .order('created_at', { ascending: false })

    
    return <AccountManagementView initialUsers={accounts || []} currentUserId={user.id} />
  }

  if (targetTab === 'global_config') {
    if (!isSystemAdmin) redirect('/dashboard/settings?tab=profile') // Anti-tamper role gate

    // Fetch global configuration settings
    const { data: settingsData, error } = await supabase.from('app_settings').select('countries').eq('id', 1).single()
    console.log('Database Row Data:', settingsData)
    console.log('Database Error (if any):', error)
    const activeCountries = settingsData?.countries || []

    return <GlobalConfigsView currentCountries={activeCountries} />
  }

  if (targetTab === 'security') {
    return <SecurityPlaceholderForm />
  }

  // Base Fallback Tab: Renders the default user profile tab view
  return <ProfilePlaceholderForm />
}
