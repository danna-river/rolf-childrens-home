// src/app/dashboard/children/[id]/edit/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EditChildForm } from './EditChildForm'
import { isAdminRole } from '@/lib/profiles'
import type { Child, ChildWithMediaRefs } from '@/lib/types'

type CountryRow = {
  name: string
}

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
    .maybeSingle() as { data: { role: string; country: string[] | null } | null; error: unknown }

  if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
    return redirect('/login?error=Unauthorized')
  }

  const { data: rawChild } = await supabase
    .from('children')
    .select(`
      *,
      profile_photo:child_media!fk_children_profile_photo(id, url),
      profile_video:child_media!fk_children_profile_video(id, url)
    `)
    .eq('id', id)
    .maybeSingle() as { data: ChildWithMediaRefs | null; error: unknown }

  if (!rawChild) return redirect('/dashboard/children')

  // ⚡ COLUMN REFERENCE FIX: Changed explicit select parameter to usage_type matching your system design
  const { data: mediaLibraryRows } = await supabase
    .from('child_media')
    .select('id, url, media_type, usage_type, filename')
    .eq('child_id', id)
    .order('created_at', { ascending: false }) as { data: Array<{ id: string; url: string; media_type: string; usage_type: string; filename: string }> | null }

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
      
    dropdownOptions = ((countryRows || []) as CountryRow[]).map((row) => row.name)
  } else {
    dropdownOptions = profile.country || []
  }

  return (
    <EditChildForm
      child={child}
      availableCountries={dropdownOptions}
      isAdmin={isSystemAdmin}
      initialLibrary={mediaLibraryRows || []}
    />
  )
}
