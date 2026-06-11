import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RegisterChildForm } from './RegisterChildForm'
import { isAdminRole } from '@/lib/profiles'

export default async function NewChildPage() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return redirect('/login?error=SessionExpired')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, country')
    .eq('id', user.id)
    .single() as { data: { role: string; country: string[] | null } | null; error: unknown }

  if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
    return redirect('/login?error=Unauthorized')
  }

  let dropdownOptions: string[] = []
  const isSystemAdmin = isAdminRole(profile.role)

  if (isSystemAdmin) {
    // Admins pull selection lists dynamically from our new PostgreSQL master table configuration
    const { data: countryRows } = await supabase
      .from('countries')
      .select('name')
      .order('name', { ascending: true })
      
    dropdownOptions = (countryRows || []).map((row: any) => row.name)
  } else {
    // Staff inherit their profile allocation arrays
    dropdownOptions = profile.country || []
  }

  return <RegisterChildForm assignedCountries={dropdownOptions} />
}