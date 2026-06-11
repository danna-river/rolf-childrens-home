"use server"

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { isAdminRole } from '@/lib/profiles'
import { revalidatePath } from 'next/cache'

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

// 🌟 Real-time sequence preview calculator when an administrator changes countries during mid-edit operations
export async function getLatestIdPreviewForEdit(countryName: string): Promise<{ previewId: string | null }> {
  const supabase = await createClient()
  
  const { data: countryRecord } = await (supabase as any)
    .from('countries')
    .select('iso_code')
    .eq('name', countryName.trim())
    .single()

  if (!countryRecord) return { previewId: null }
  const prefix = countryRecord.iso_code

  const { data: siblingRecords } = await (supabase as any)
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
  return { previewId: `${prefix}-${String(currentMaxNumber + 1).padStart(4, '0')}` }
}

// 🌟 Asynchronous structural interceptor running deep format validation and collision scans on save
export async function checkRolfIdForEdit(
  idRolf: string,
  countryName: string,
  currentChildId: string
): Promise<{ isValid: boolean; error: string | null; expectedPrefix: string | null }> {
  const supabase = await createClient()

  const { data: countryData } = await (supabase as any)
    .from('countries')
    .select('iso_code')
    .eq('name', countryName.trim())
    .single()

  if (!countryData) {
    return { isValid: false, error: `Country configuration parameters for "${countryName}" could not be found.`, expectedPrefix: null }
  }

  const prefix = countryData.iso_code
  const targetId = idRolf.trim().toUpperCase()

  if (!targetId.startsWith(`${prefix}-`)) {
    return { isValid: false, error: `Format Mismatch: The manual ROLF ID prefix must match the chosen country row format (${prefix}-XXXX).`, expectedPrefix: prefix }
  }

  // Look for any OTHER child record using this unique ID to avoid blocking self-saves when ID is untouched
  const { data } = await supabase
    .from('children')
    .select('id')
    .eq('id_rolf', targetId)
    .neq('id', currentChildId)
    .maybeSingle()

  if (data) {
    return { isValid: false, error: `Identity Collision: The ROLF ID "${targetId}" is already assigned to another active child record.`, expectedPrefix: prefix }
  }

  return { isValid: true, error: null, expectedPrefix: prefix }
}

export async function updateChildAction(
  id: string,
  input: UpdateChildInput,
): Promise<{ error: string | null }> {
  // Security Interceptor: Verify modification scopes completely on the server using active profile country privileges
  const { profile } = await requireAuth()
  const isSystemAdmin = isAdminRole(profile.role)
  const userAllowedCountries: string[] = profile.country || []

  if (!isSystemAdmin && !userAllowedCountries.includes(input.country)) {
    return { 
      error: `Security Violation: Your user profile does not have permission scopes allocated to manage records for "${input.country}".` 
    }
  }

  const supabase = await createClient()
  const display_name = `${input.first_name} ${input.last_name}`.trim()

  const { error } = await (supabase as any)
    .from('children')
    .update({
      id_rolf: input.id_rolf.trim().toUpperCase(),
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

    // Purge the layout router cache so the dashboard immediately shows the new edits
    revalidatePath('/dashboard/children') 
    revalidatePath(`/dashboard/children/${id}/edit`)
  
    return { error: null }
}