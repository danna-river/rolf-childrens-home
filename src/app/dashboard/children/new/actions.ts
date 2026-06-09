"use server"
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth'
import { isAdminRole } from '@/lib/profiles'
import type { RegisterChildInput } from '@/components/actions'

export async function generateRolfId(
  country: string,
): Promise<{ id: string | null; error: string | null }> {

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminSupabase = createAdminClient() as any
  const { data: countryRecord, error: countryError } = await adminSupabase
    .from('countries')
    .select('iso_code')
    .eq('name', country.trim())
    .single()

  if (countryError || !countryRecord) {
    return { id: null, error: `No country code found for "${country}" in the system dictionary.` }
  }

  const code = countryRecord.iso_code

  const { data } = await adminSupabase
    .from('children')
    .select('id_rolf')
    .like('id_rolf', `${code}-%`)

  let max = 0
  for (const row of (data ?? []) as { id_rolf: string | null }[]) {
    const match = row.id_rolf?.match(/^[A-Z]+-(\d+)$/)
    if (match) {
      const n = parseInt(match[1], 10)
      if (n > max) max = n
    }
  }

  return { id: `${code}-${String(max + 1).padStart(4, '0')}`, error: null }
}

export async function registerChildAction(
  input: RegisterChildInput,
): Promise<{ id: string | null; error: string | null }> {
  const { user, profile } = await requireAuth()
  const isSystemAdmin = isAdminRole(profile.role)
  const userAllowedCountries: string[] = profile.country || []

  if (!isSystemAdmin && !userAllowedCountries.includes(input.country)) {
    return { 
      id: null, 
      error: `Security Violation: Your user profile does not have access permissions to register records for "${input.country}".` 
    }
  }

  const adminSupabase = createAdminClient()
  const display_name = `${input.first_name} ${input.last_name}`.trim()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (adminSupabase as any)
    .from('children')
    .insert({
      id_rolf: input.id_rolf || null,
      display_name,
      first_name: input.first_name,
      last_name: input.last_name,
      age: input.age,
      
      // Split Calendar Columns
      birth_year: input.birth_year || null,
      birth_month: input.birth_month || null,
      birth_day: input.birth_day || null,
      
      year_joined: input.year_joined || null,
      date_joined: input.date_joined || null,
      country: input.country,
      career_aspiration: input.career_aspiration || null,
      favorite_subject: input.favorite_subject || null,
      hobby: input.hobby || null,
      bio: input.bio || null,
      
      // Storage Bucket Text URL Asset Fields
      profile_photo: input.profile_photo || null,
      profile_video: input.profile_video || null,
      
      // Default Base Table Requirements
      status: 'active',
      edit_log: [], // Safely seeding default empty jsonb array to prevent column constraints tripping
      
      // 🌟 Audit Column Link: Maps a clean foreign key pointer directly back to public.profiles.id
      created_by: user.id 
    })
    .select('id')
    .single()
  if (error) return { id: null, error: error.message }
  return { id: (data as { id: string }).id, error: null }
}
