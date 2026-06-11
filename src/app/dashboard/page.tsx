import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AuthorizedView } from '@/app/dashboard/components/authorized-view'
import { UnapprovedView } from '@/app/dashboard/components/unapproved-view'
import { isAdminRole, isStaffRole, isUnapprovedRole } from '@/lib/profiles'

export default async function DashboardOrchestratorPage() {
  const { user, profile } = await requireAuth({ allowUnapproved: true })
  
  // 🌟 CRITICAL EDGE-CASE FIX: Handle authenticated users who are missing a profile row
  if (!profile) {
    const supabase = await createClient()
    // Force sign them out right here to clear the bad browser session tokens completely
    await supabase.auth.signOut()
    
    // Redirect them back to login with a clear error context string
    return redirect('/login?error=ProfileMissing')
  }

  // Safe to continue: we are guaranteed to have a profile object here
  if (isUnapprovedRole(profile.role)) {
    return <UnapprovedView email={user.email || ''} />
  }

  let identityTitle = 'Donor Portal'
  if (isAdminRole(profile.role)) identityTitle = 'Administrator Portal'
  if (isStaffRole(profile.role)) identityTitle = 'Regional Staff Portal'

  return (
    <AuthorizedView 
      email={user.email || ''} 
      identityTitle={identityTitle} 
    />
  )
}