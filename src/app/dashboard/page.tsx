import { requireAuth } from '@/lib/auth'
import { AuthorizedView } from '@/app/dashboard/components/authorized-view'
import { UnapprovedView } from '@/app/dashboard/components/unapproved-view'
import { isAdminRole, isStaffRole, isUnapprovedRole } from '@/lib/profiles'

export default async function DashboardOrchestratorPage() {
  const { user, profile } = await requireAuth({allowUnapproved: true})
  
  if (isUnapprovedRole(profile.role)) {
    return <UnapprovedView email={user.email || ''} />
  }

  let portalType: 'admin' | 'staff' | 'donor' = 'donor'
  if (isAdminRole(profile.role)) portalType = 'admin'
  if (isStaffRole(profile.role)) portalType = 'staff'

  return (
    <AuthorizedView 
      email={user.email || ''} 
      portalType={portalType}
    />
  )
}
