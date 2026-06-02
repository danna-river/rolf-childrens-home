import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminView } from '@/app/dashboard/children/components/admin-view'
import { StaffView } from '@/app/dashboard/children/components/staff-view'

interface UserProfile {
  role: 'admin' | 'data_inputer' | 'donor'
  country: string[] | null
}

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
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return redirect('/login?error=SessionExpired')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, country')
    .eq('id', user.id)
    .single() as { data: UserProfile | null; error: unknown }

  if (profileError || !profile) {
    return redirect('/login?error=Unauthorized')
  }

  const sanitizedRole = profile.role.trim().toLowerCase()

  if (sanitizedRole === 'super_admin' || sanitizedRole === 'admin') {
    return <AdminView searchParams={searchParams} />
  }

  if (sanitizedRole === 'data_inputer' || sanitizedRole === 'staff') {
    const checkedCountries = Array.isArray(profile.country) ? profile.country : []
    return <StaffView assignedCountries={checkedCountries} searchParams={searchParams} />
  }

  return redirect('/login?error=Unauthorized')
}
