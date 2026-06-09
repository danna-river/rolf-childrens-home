import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EditChildForm } from './EditChildForm'
import type { Child } from '@/lib/types'

export default async function EditChildPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return redirect('/login?error=SessionExpired')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, country')
    .eq('id', user.id)
    .single() as { data: { role: string; country: string | string[] | null } | null; error: unknown }

  if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
    return redirect('/login?error=Unauthorized')
  }

  const { data: child } = await supabase
    .from('children')
    .select('*')
    .eq('id', id)
    .single() as { data: Child | null; error: unknown }

  if (!child) return redirect('/dashboard/children')

  const assignedCountries: string[] = profile.role === 'admin'
    ? [child.country ?? ''].filter(Boolean)
    : Array.isArray(profile.country) ? profile.country : []

  return (
    <EditChildForm
      child={child}
      assignedCountries={assignedCountries}
      isAdmin={profile.role === 'admin'}
    />
  )
}
