"use server"

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth'
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

export async function getLatestIdPreview(countryName: string): Promise<{ previewId: string | null; error: string | null }> {
  const adminSupabase = await createAdminClient()

  const { data: countryRecord } = await (adminSupabase as any)
    .from('countries')
    .select('iso_code')
    .eq('name', countryName.trim())
    .single()

  if (!countryRecord) return { previewId: null, error: "Country not configured." }
  const prefix = countryRecord.iso_code

  const { data: siblingRecords } = await (adminSupabase as any)
    .from('children')
    .select('id_rolf')
    .like('id_rolf', `${prefix}-%`)

  let currentMaxNumber = 0
  if (siblingRecords) {
    for (const record of siblingRecords) {
      const match = record.id_rolf?.match(/^[A-Z]+-(\d+)$/)
      if (match) {
        const parsedNumber = parseInt(match[1], 10)
        if (parsedNumber > currentMaxNumber) currentMaxNumber = parsedNumber
      }
    }
  }

  return { 
    previewId: `${prefix}-${String(currentMaxNumber + 1).padStart(4, '0')}`, 
    error: null 
  }
}

// 🌟 NEW INTERCEPTOR: Runs on Step 0 "Continue" for Admins to prevent moving forward with broken inputs
export async function checkRolfIdForRegistration(
  idRolf: string,
  countryName: string
): Promise<{ isValid: boolean; error: string | null }> {
  const adminSupabase = await createAdminClient()

  const { data: countryData } = await (adminSupabase as any)
    .from('countries')
    .select('iso_code')
    .eq('name', countryName.trim())
    .single()

  if (!countryData) {
    return { isValid: false, error: `Country configuration mapping parameters for "${countryName}" could not be found.` }
  }

  const prefix = countryData.iso_code
  const targetId = idRolf.trim().toUpperCase()

  if (!targetId.startsWith(`${prefix}-`)) {
    return { isValid: false, error: `Format Mismatch: The ROLF ID must match the chosen country prefix layout (${prefix}-XXXX).` }
  }

  const { data } = await adminSupabase
    .from('children')
    .select('id')
    .eq('id_rolf', targetId)
    .maybeSingle()

  if (data) {
    return { isValid: false, error: `Identity Collision: The ROLF ID "${targetId}" is already assigned to an active child record.` }
  }

  return { isValid: true, error: null }
}

export async function registerChildAction(
  input: RegisterChildInput,
): Promise<{ id: string | null; error: string | null; generatedId?: string }> {
  const { user, profile } = await requireAuth()
  const isSystemAdmin = isAdminRole(profile.role)
  const userAllowedCountries: string[] = profile.country || []

  if (!isSystemAdmin && !userAllowedCountries.includes(input.country)) {
    return { 
      id: null, 
      error: `Security Violation: Your profile does not have access permissions to register records for "${input.country}".` 
    }
  }

  const adminSupabase = await createAdminClient()

  const { data: countryRecord, error: countryError } = await (adminSupabase as any)
    .from('countries')
    .select('iso_code')
    .eq('name', input.country.trim())
    .single()

  if (countryError || !countryRecord) {
    return { id: null, error: `Configuration Error: Could not find an active prefix for country "${input.country}".` }
  }

  const prefix = countryRecord.iso_code
  const targetRolfId = input.id_rolf.trim().toUpperCase()

  if (!targetRolfId.startsWith(`${prefix}-`)) {
    return { id: null, error: `Format Discrepancy: The ROLF ID must match the chosen country row prefix format (${prefix}-XXXX).` }
  }

  const { data: collisionCheck } = await adminSupabase
    .from('children')
    .select('id')
    .eq('id_rolf', targetRolfId)
    .maybeSingle()

  if (collisionCheck) {
    return { id: null, error: `Identity Collision: The ROLF ID "${targetRolfId}" is already claimed by another record.` }
  }

  const display_name = `${input.first_name} ${input.last_name}`.trim()
  
  const { data, error: insertError } = await (adminSupabase as any)
    .from('children')
    .insert({
      id_rolf: targetRolfId,
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
      profile_photo: input.profile_photo ?? null,
      profile_video: input.profile_video ?? null,
      status: 'active',
      edit_log: [],
      created_by: user.id 
    })
    .select('id')
    .single()
    
  if (insertError) return { id: null, error: insertError.message }
  return { id: (data as { id: string }).id, error: null, generatedId: targetRolfId }
}