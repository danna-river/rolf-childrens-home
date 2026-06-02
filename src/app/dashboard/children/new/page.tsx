import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RegisterChildForm } from './RegisterChildForm'

interface UserProfile {
  role: 'admin' | 'data_inputer' | 'donor'
  country: string[] | null
}

export default async function NewChildPage() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return redirect('/login?error=SessionExpired')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, country')
    .eq('id', user.id)
    .single() as { data: UserProfile | null; error: unknown }

  if (!profile || (profile.role !== 'admin' && profile.role !== 'data_inputer')) {
    return redirect('/login?error=Unauthorized')
  }

  const countries: string[] = Array.isArray(profile.country) ? profile.country : []

  return <RegisterChildForm assignedCountries={countries} isAdmin={profile.role === 'admin'} />
}
