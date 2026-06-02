// src/app/dashboard/children/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminView } from '@/app/dashboard/children/components/admin-view'
import { InputterView } from '@/app/dashboard/children/components/inputter-view'

// Define the exact shape your old schema expects
interface UserProfile {
  role: 'admin' | 'data_inputer' | 'donor';
  country: string[] | null;
}

export default async function UnifiedChildrenPage() {
  const supabase = await createClient()

  // 1. Authenticate browser session cookies
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    console.error("🔒 ORCHESTRATOR: No valid session token.")
    return redirect('/login?error=SessionExpired')
  }

  // 2. Query the user profile row with explicit type casting
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, country')
    .eq('id', user.id)
    .single() as { data: UserProfile | null; error: any } // 👈 Explicit type cast fixes the 'never' error

  if (profileError || !profile) {
    console.error(`❌ ORCHESTRATOR: Database profile match missing for ${user.id}:`, profileError?.message)
    return redirect('/login?error=Unauthorized')
  }

  // 3. Normalize role parameter text safely
  const sanitizedRole = profile.role.trim().toLowerCase()

  if (sanitizedRole === 'super_admin' || sanitizedRole === 'admin') {
    return <AdminView />
  }

  if (sanitizedRole === 'data_inputer' || sanitizedRole === 'staff') {
    // Systemic Array Hand-off: Safe fallback to an empty array literal
    const checkedCountries: string[] = Array.isArray(profile.country) 
      ? profile.country 
      : []

    return <InputterView assignedCountries={checkedCountries} />
  }

  console.warn(`⚠️ ORCHESTRATOR: Access denied. Role classification '${profile.role}' is invalid.`)
  return redirect('/login?error=UnknownRole')
}