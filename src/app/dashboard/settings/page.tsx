import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isAdminRole } from '@/lib/profiles'
import { getUserLocale } from '@/i18n/server'
import { ExportView } from './components/admin/export-view'

// View components imports
import { AccountApprovalView } from '@/app/dashboard/settings/components/admin/account-approval-view'
import { GlobalConfigsView } from '@/app/dashboard/settings/components/admin/global-configs-view'
import { AccountManagementView } from '@/app/dashboard/settings/components/admin/account-management-view'
import { ProfileView } from './components/profile-view'
import { SecurityView } from './components/security-view'
import { IntakeView } from './components/admin/intake-view'
import { FaceSearchView } from './components/admin/face-search-view'
import { getFaceBackfillQueue, getFaceTemplateStats } from '@/lib/face/actions'

type SettingsPageProps = {
  searchParams: Promise<{ tab?: string }>
}

type CountryNameRow = {
  name: string
}

export default async function SettingsTabDispatcherPage({ searchParams }: SettingsPageProps) {
  // 1. Run the auth check to load active user profile metrics safely on the server
  const { user, profile } = await requireAuth({ allowUnapproved: true })

  const resolvedParams = await searchParams
  const targetTab = resolvedParams.tab || 'profile'
  const isSystemAdmin = isAdminRole(profile.role)
  const locale = await getUserLocale(user.id)

  const supabase = await createClient()

  // 2. DISPATCHER PATTERN: Match conditions sequentially to isolate view blocks
  if (targetTab === 'approvals') {
    if (!isSystemAdmin) redirect('/dashboard/settings?tab=profile') // Anti-tamper role gate

    // 1. Fetch unapproved accounts query payload
    const { data: pendingUsers } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, country, created_at')
      .eq('role', 'unapproved')
      .order('created_at', { ascending: false })

    const { data: countriesData } = await supabase
      .from('countries')
      .select('name')
      .order('name', { ascending: true })

    // 3. Extract the names safely into a string array format
    const activeCountries = ((countriesData ?? []) as CountryNameRow[]).map(
      (country) => country.name,
    )

    return (
      <AccountApprovalView
        initialUsers={pendingUsers || []}
        availableCountries={activeCountries}
      />
    )
  }

  if (targetTab === 'manage_users') {
    if (!isSystemAdmin) redirect('/dashboard/settings?tab=profile')

    const { data: accounts } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, country, created_at')
      .in('role', ['admin', 'staff', 'donor'])
      .order('role', { ascending: true })
      .order('created_at', { ascending: false })

    // 🌟 ADDED: Query your true populated 'countries' table
    const { data: countriesData } = await supabase
      .from('countries')
      .select('name')
      .order('name', { ascending: true })
      
    const activeCountries = ((countriesData ?? []) as CountryNameRow[]).map(
      (country) => country.name,
    )

    return (
      <AccountManagementView 
        initialUsers={accounts || []} 
        currentUserId={user.id} 
        availableCountries={activeCountries} // 👈 Pass down the prop
      />
    )
  }

  if (targetTab === 'global_config') {
    if (!isSystemAdmin) redirect('/dashboard/settings?tab=profile') // Anti-tamper role gate

    // Fetch global configuration settings
    const { data: countriesData } = await supabase
      .from('countries')
      .select('name')
      .order('name', { ascending: true })
    const activeCountries = ((countriesData ?? []) as CountryNameRow[]).map(
      (country) => country.name,
    )

    return <GlobalConfigsView currentCountries={activeCountries} />
  }

  if (targetTab === 'intake_form') {
    if (!isSystemAdmin) redirect('/dashboard/settings?tab=profile') // Anti-tamper role gate

    return <IntakeView />
  }

  if (targetTab === 'face_search') {
    if (!isSystemAdmin) redirect('/dashboard/settings?tab=profile') // Anti-tamper role gate

    const [statsResult, queueResult] = await Promise.all([
      getFaceTemplateStats(),
      getFaceBackfillQueue(),
    ])

    return (
      <FaceSearchView
        initialStats={statsResult.stats}
        initialPending={queueResult.items.length}
        initialError={statsResult.error ?? queueResult.error}
      />
    )
  }

  if (targetTab === 'security') {
    return <SecurityView />
  }

  if (targetTab === 'export_data') {
    if (!isSystemAdmin) redirect('/dashboard/settings?tab=profile') // Anti-tamper role gate
    return <ExportView />
  }

  // Base Fallback Tab: Renders the default user profile tab view
  return (
    <ProfileView
      initialName={profile?.full_name || ''}
      email={user?.email || ''}
      initialLocale={locale}
      isDonor={profile.role === 'donor'}
    />
  )
}
