import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AdminView } from '@/app/dashboard/children/components/admin-view'
import { StaffView } from '@/app/dashboard/children/components/staff-view'
import { DonorView } from '@/app/dashboard/children/components/donor-view'
import { isAdminRole, isDonorRole, isStaffRole} from '@/lib/profiles'

type ChildrenSearchParams = {
  search?: string
  status?: string
  country?: string | string[]
  sort?: string
}

export default async function UnifiedChildrenPage({
  searchParams,
}: {
  searchParams: Promise<ChildrenSearchParams>
}) {
  const { profile } = await requireAuth()

  if (isAdminRole(profile.role)) {
    return <AdminView searchParams={searchParams} />
  }

  if (isStaffRole(profile.role)) {
    const checkedCountries = Array.isArray(profile.country) ? profile.country : []
    return <StaffView assignedCountries={checkedCountries} searchParams={searchParams} />
  }

  if (isDonorRole(profile.role)) {
    return <DonorView />
  }

  return redirect('/login?error=Unauthorized')
}
