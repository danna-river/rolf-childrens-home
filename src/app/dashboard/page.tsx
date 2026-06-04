import { requireAuth } from '@/lib/auth'
import { AuthorizedView } from '@/app/dashboard/components/authorized-view'
import { UnapprovedView } from '@/app/dashboard/components/unapproved-view'
import { isAdminRole, isStaffRole, isUnapprovedRole, type UserProfile } from '@/lib/profiles'

export default async function DashboardOrchestratorPage() {
  const { user, profile } = await requireAuth({allowUnapproved: true})
  
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