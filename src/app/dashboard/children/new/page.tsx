import { createClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/profiles'
import { RegisterChildForm } from '@/app/dashboard/children/new/RegisterChildForm'
import { requireAuth } from '@/lib/auth'

export default async function NewChildPage() {
  const { profile } = await requireAuth()
  const isSystemAdmin = isAdminRole(profile.role)
  
  let dropdownOptions: string[] = []

  if (isSystemAdmin) {
    // Admins get the live master list from your newly provisioned countries table
    const supabase = await createClient()
    const { data: countryRows } = await supabase
      .from('countries')
      .select('name')
      .order('name', { ascending: true })
      
    dropdownOptions = (countryRows || []).map((row: any) => row.name)
  } else {
    // Field staff get their restricted assigned array boundaries
    dropdownOptions = profile.country || []
  }

  return <RegisterChildForm availableCountries={dropdownOptions} />
}
