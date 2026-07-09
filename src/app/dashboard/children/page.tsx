import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AdminView } from '@/app/dashboard/children/components/admin-view'
import { StaffView } from '@/app/dashboard/children/components/staff-view'
import { DonorView } from '@/app/dashboard/children/components/donor-view'
import { isAdminRole, isDonorRole, isStaffRole} from '@/lib/profiles'
import { getMessages, getUserLocale } from '@/i18n/server'

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
  const { user, profile } = await requireAuth()
  const locale = await getUserLocale(user.id)
  const messages = getMessages(locale)

  if (isAdminRole(profile.role)) {
    return <AdminView searchParams={searchParams} messages={messages} locale={locale} />
  }

  if (isStaffRole(profile.role)) {
    const checkedCountries = Array.isArray(profile.country) ? profile.country : []
    return <StaffView assignedCountries={checkedCountries} searchParams={searchParams} messages={messages} locale={locale} />
  }

  if (isDonorRole(profile.role)) {
    return <DonorView donorProfileId={user.id} />
  }

  return redirect('/login?error=Unauthorized')
}
