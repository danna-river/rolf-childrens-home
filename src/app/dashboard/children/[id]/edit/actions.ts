// src/app/dashboard/children/[id]/edit/actions.ts
"use server"

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth'
import { isAdminRole } from '@/lib/profiles'

export type UpdateChildInput = {
  id_rolf: string
  first_name: string
  last_name: string
  birth_year?: number
  birth_month?: number
  birth_day?: number
  age: number
  year_joined?: number
  date_joined?: string
  country: string
  career_aspiration: string
  favorite_subject: string
  hobby: string
  bio?: string
  notes?: string
  profile_photo: string | null
  profile_video: string | null
  status: 'active' | 'inactive'
}

export async function checkRolfIdForEdit(
  idRolf: string,
  countryName: string,
  currentChildId: string
): Promise<{ isTaken: boolean; expectedPrefix: string | null }> {
  const adminSupabase = await createAdminClient()
  
  const { data: countryData } = await (adminSupabase as any)
    .from('countries')
    .select('iso_code')
    .eq('name', countryName.trim())
    .single()

  const expectedPrefix = countryData?.iso_code || null

  // Check if any OTHER child record is currently utilizing this specific unique ID
  const { data: idData } = await adminSupabase
    .from('children')
    .select('id')
    .eq('id_rolf', idRolf.trim().toUpperCase())
    .neq('id', currentChildId)
    .maybeSingle()

  return {
    isTaken: !!idData,
    expectedPrefix
  }
}

export async function updateChildAction(
  id: string,
  input: UpdateChildInput,
): Promise<{ error: string | null }> {
  // 🛡️ Security Interceptor: Verify modification scopes completely on the server
  const { profile } = await requireAuth()
  const isSystemAdmin = isAdminRole(profile.role)
  const userAllowedCountries: string[] = profile.country || []

  if (!isSystemAdmin && !userAllowedCountries.includes(input.country)) {
    return { 
      error: `Security Violation: Your user profile does not have permission scopes allocated to manage records for "${input.country}".` 
    }
  }

  const adminSupabase = await createAdminClient()
  const display_name = `${input.first_name} ${input.last_name}`.trim()

  const { error } = await (adminSupabase as any)
    .from('children')
    .update({
      id_rolf: input.id_rolf,
      display_name,
      first_name: input.first_name,
      last_name: input.last_name,
      age: input.age,
      birth_year: input.birth_year ?? null,
      birth_month: input.birth_month ?? null,
      birth_day: input.birth_day ?? null,
      year_joined: input.year_joined ?? null,
      date_joined: input.date_joined ?? null,
      country: input.country,
      career_aspiration: input.career_aspiration,
      favorite_subject: input.favorite_subject,
      hobby: input.hobby,
      bio: input.bio ?? null,
      notes: input.notes ?? null,
      profile_photo: input.profile_photo,
      profile_video: input.profile_video,
      status: input.status,
    })
    .eq('id', id)

  if (error) return { error: error.message }
  return { error: null }
}