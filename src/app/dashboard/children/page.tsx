// src/app/dashboard/children/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminView } from '@/app/dashboard/children/components/admin-view'
import { InputterView } from '@/app/dashboard/children/components/inputter-view'

export default async function UnifiedChildrenPage() {
  const supabase = await createClient()

  // 1. Enforce active session check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return redirect('/login')
  }

  // 2. Fetch the user profile permissions token
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, country')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return redirect('/login?error=Unauthorized')
  }

  // 3. 🚦 Secure traffic direction via server components
  switch ((profile as { role: string }).role) {
    case 'SUPER_ADMIN':
    case 'admin':
      return <AdminView />

    case 'data_inputer':
    case 'STAFF':
      // Routing explicitly hands off to your renamed Inputer module setup
      return <InputterView assignedCountries={(profile as { country: string[] }).country || []} />

    default:
      return redirect('/login?error=UnknownRole')
  }
}