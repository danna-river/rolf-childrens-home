"use server"

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth' // 🌟 Points directly to your real authentication file
import { isAdminRole } from '@/lib/profiles'

export type RegisterChildInput = {
  id_rolf: string
  first_name: string
  last_name: string
  age: number
  birth_year?: number
  birth_month?: number
  birth_day?: number
  year_joined?: number
  date_joined?: string
  country: string
  career_aspiration: string
  favorite_subject: string
  hobby: string
  bio?: string
  profile_photo?: string | null
  profile_video?: string | null
}

export async function generateRolfId(
  country: string,
): Promise<{ id: string | null; error: string | null }> {
  const adminSupabase = await createAdminClient()

  // Pull prefix live from our real country tracking matrix table
  const { data: countryRecord, error: countryError } = await (adminSupabase as any)
    .from('countries')
    .select('iso_code')
    .eq('name', country.trim())
    .single()

  if (countryError || !countryRecord) {
    return { id: null, error: `No country code for "${country}". Enter the ID manually.` }
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
  // 🛡️ Server-side verification guard
  const { user, profile } = await requireAuth()
  const isSystemAdmin = isAdminRole(profile.role)
  const userAllowedCountries: string[] = profile.country || []

  if (!isSystemAdmin && !userAllowedCountries.includes(input.country)) {
    return { 
      id: null, 
      error: `Security Violation: Your user profile does not have access permissions to register records for "${input.country}".` 
    }
  }

  const adminSupabase = await createAdminClient()

  // 🌟 ATOMIC ATTEMPT TO WRITE VALUE: Perform unique identity verification once right here on save
  const { data: idData } = await adminSupabase
    .from('children')
    .select('id')
    .eq('id_rolf', input.id_rolf.trim().toUpperCase())
    .maybeSingle()

  if (idData) {
    return { id: null, error: `Identity Collision: The ROLF ID "${input.id_rolf.toUpperCase()}" is already assigned to an active child record.` }
  }

  const { data: countryData } = await (adminSupabase as any)
    .from('countries')
    .select('iso_code')
    .eq('name', input.country.trim())
    .single()

  const expectedPrefix = countryData?.iso_code
  if (!expectedPrefix || !input.id_rolf.startsWith(`${expectedPrefix}-`)) {
    return { id: null, error: `Format Discrepancy: The ROLF ID prefix must match the chosen country row format (${expectedPrefix}-XXXX).` }
  }

  const display_name = `${input.first_name} ${input.last_name}`.trim()
  
  const { data, error } = await (adminSupabase as any)
    .from('children')
    .insert({
      id_rolf: input.id_rolf,
      display_name,
      first_name: input.first_name,
      last_name: input.last_name,
      age: input.age,
      
      // Strict Table Calendar Separations
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
      profile_photo: input.profile_photo ?? null,
      profile_video: input.profile_video ?? null,
      status: 'active',
      edit_log: [],
      
      // 🌟 Audit Column Pointer: Maps a clean foreign key directly back to profiles table
      created_by: user.id 
    })
    .select('id')
    .single()
    
  if (error) return { id: null, error: error.message }
  return { id: (data as { id: string }).id, error: null }
}