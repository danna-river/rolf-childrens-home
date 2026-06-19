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

  // 🌟 Strict 4-digit formatting rule
  const strictFormatRegex = new RegExp(`^${prefix}-\\d{4}$`)

  if (!strictFormatRegex.test(targetId)) {
    return {
      isValid: false,
      error: `Format Mismatch: The manual ROLF ID must match the chosen country row format (${prefix}-XXXX) with exactly 4 digits.`,
      expectedPrefix: prefix // 🌟 Add this line to satisfy the TypeScript compiler!
    }
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
  // 1. Security Interceptor: Verify modification scopes
  const { profile: actorProfile } = await requireAuth()
  const isSystemAdmin = isAdminRole(actorProfile.role)
  const userAllowedCountries: string[] = actorProfile.country || []

  if (!isSystemAdmin && !userAllowedCountries.includes(input.country)) {
    return {
      error: `Security Violation: Your user profile does not have permission scopes allocated to manage records for "${input.country}".`
    }
  }

  const supabase = await createClient()

  // 2. Fetch the CURRENT state of the child to compare changes and get existing log
  const { data: currentChild, error: fetchError } = await (supabase as any)
    .from('children')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !currentChild) {
    return { error: "Failed to locate the original child record for delta logging." }
  }

  // 3. Fetch the full name of the editor from the profiles table
  const { data: fullProfileData } = await (supabase as any)
    .from('profiles')
    .select('full_name')
    .eq('id', actorProfile.id)
    .single()

  const actorFullName = fullProfileData?.full_name || 'Unknown User'

  // 4. Calculate exactly what fields changed
  const changes: Array<{ field: string; from: any; to: any }> = []

  // Format dates consistently to avoid false positive matches
  const normalizeDate = (val: any) => val ? new Date(val).toISOString().split('T')[0] : null

  const fieldsToTrack: Array<keyof UpdateChildInput> = [
    'id_rolf', 'first_name', 'last_name', 'country',
    'career_aspiration', 'favorite_subject', 'hobby', 'bio', 'notes', 'status'
  ]

  fieldsToTrack.forEach((field) => {
    let currentVal = currentChild[field]
    let newVal = input[field]

    if (typeof currentVal === 'string') currentVal = currentVal.trim() || null
    else if (currentVal === undefined) currentVal = null

    if (typeof newVal === 'string') newVal = newVal.trim() || null
    else if (newVal === undefined) newVal = null

    // Handle date fields or string trims gracefully
    if (field === 'date_joined') {
      currentVal = normalizeDate(currentVal)
      newVal = normalizeDate(newVal)
    } else if (typeof currentVal === 'string') {
      currentVal = currentVal.trim()
    }

    if (currentVal !== newVal) {
      changes.push({
        field,
        from: currentVal ?? '—',
        to: newVal ?? '—'
      })
    }
  })

  // 5. Construct the new log entry if changes were caught
  let updatedLog = currentChild.edit_log || []
  if (changes.length > 0) {
    const newLogEntry = {
      timestamp: new Date().toISOString(),
      profile: {
        id: actorProfile.id,
        full_name: actorFullName,
        role: actorProfile.role,
        country: actorProfile.country
      },
      changes
    }
    // Prepend new edits to the front of the timeline log
    updatedLog = [newLogEntry, ...updatedLog]
  }

  const display_name = `${input.first_name} ${input.last_name}`.trim()

  // 6. Push data updates alongside the new log matrix to Supabase
  const { error } = await (supabase as any)
    .from('children')
    .update({
      id_rolf: input.id_rolf.trim().toUpperCase(),
      display_name,
      first_name: input.first_name,
      last_name: input.last_name,
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
      edit_log: updatedLog, // Push updated jsonb array
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/children')
  revalidatePath(`/dashboard/children/${id}`)

  return { error: null }
}