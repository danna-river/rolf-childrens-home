// src/app/dashboard/children/[id]/edit/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EditChildForm } from './EditChildForm'
import { isAdminRole } from '@/lib/profiles'
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
    .single() as { data: { role: string; country: string[] | null } | null; error: unknown }

  if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
    return redirect('/login?error=Unauthorized')
  }

  // ⚡ UPDATE: Swapped out select('*') to query media asset URL strings relationally
  const { data: rawChild } = await supabase
    .from('children')
    .select(`
      *,
      profile_photo:child_media!fk_children_profile_photo(id, url),
      profile_video:child_media!fk_children_profile_video(id, url)
    `)
    .eq('id', id)
    .single() as { data: any | null; error: unknown }

  if (!rawChild) return redirect('/dashboard/children')

  // ⚡ UPDATE: Unpack and flatten nested media arrays into plain URL strings for client state previewing
  const child: Child = {
    ...rawChild,
    profile_photo: rawChild.profile_photo?.url ?? null,
    profile_video: rawChild.profile_video?.url ?? null,
  }

  let dropdownOptions: string[] = []
  const isSystemAdmin = isAdminRole(profile.role)

  if (isSystemAdmin) {
    const { data: countryRows } = await supabase
      .from('countries')
      .select('name')
      .order('name', { ascending: true })
      
    dropdownOptions = (countryRows || []).map((row: any) => row.name)
  } else {
    dropdownOptions = profile.country || []
  }

  return (
    <EditChildForm
      child={child}
      availableCountries={dropdownOptions}
      isAdmin={isSystemAdmin}
    />
  )
}