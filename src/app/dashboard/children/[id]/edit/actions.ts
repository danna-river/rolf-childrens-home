"use server"

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { ageFromBirthParts, ensureBioIncludesAgeAndCountry, homeDurationFromDate } from '@/lib/bio'
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

  const strictFormatRegex = new RegExp(`^${prefix}-\\d{4}$`)

  if (!strictFormatRegex.test(targetId)) {
    return {
      isValid: false,
      error: `Format Mismatch: The manual ROLF ID must match the chosen country row format (${prefix}-XXXX) with exactly 4 digits.`,
      expectedPrefix: prefix
    }
  }

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
  const { profile: actorProfile } = await requireAuth()
  const isSystemAdmin = isAdminRole(actorProfile.role)
  const userAllowedCountries: string[] = actorProfile.country || []

  if (!isSystemAdmin && !userAllowedCountries.includes(input.country)) {
    return {
      error: `Security Violation: Your user profile does not have permission scopes allocated to manage records for "${input.country}".`
    }
  }

  const supabase = await createClient()

  const { data: currentChild, error: fetchError } = await (supabase as any)
    .from('children')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !currentChild) {
    return { error: "Failed to locate the original child record for delta logging." }
  }

  const { data: fullProfileData } = await (supabase as any)
    .from('profiles')
    .select('full_name')
    .eq('id', actorProfile.id)
    .single()

  const actorFullName = fullProfileData?.full_name || 'Unknown User'
  const normalizedInput: UpdateChildInput = {
    ...input,
    bio: input.bio
      ? ensureBioIncludesAgeAndCountry(input.bio, {
          age: ageFromBirthParts(input.birth_year, input.birth_month, input.birth_day),
          country: input.country,
          homeDuration: homeDurationFromDate(input.date_joined ?? (input.year_joined ? `${input.year_joined}-01-01` : null)),
        })
      : undefined,
  }

  const changes: Array<{ field: string; from: any; to: any }> = []
  const normalizeDate = (val: any) => val ? new Date(val).toISOString().split('T')[0] : null

  const fieldsToTrack: Array<keyof UpdateChildInput> = [
    'id_rolf', 'first_name', 'last_name', 'country',
    'career_aspiration', 'favorite_subject', 'hobby', 'bio', 'notes', 'status',
    'date_joined', 'year_joined', 'birth_year', 'birth_month', 'birth_day'
  ]

  fieldsToTrack.forEach((field) => {
    let currentVal = currentChild[field]
    let newVal = normalizedInput[field]

    if (typeof currentVal === 'string') currentVal = currentVal.trim() || null
    else if (currentVal === undefined) currentVal = null

    if (typeof newVal === 'string') newVal = newVal.trim() || null
    else if (newVal === undefined) newVal = null

    if (field === 'date_joined') {
      currentVal = normalizeDate(currentVal)
      newVal = normalizeDate(newVal)
    }

    if (String(currentVal ?? '') !== String(newVal ?? '')) {
      changes.push({
        field,
        from: currentVal ?? '—',
        to: newVal ?? '—'
      })
    }
  })

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
    updatedLog = [newLogEntry, ...updatedLog]
  }

  const display_name = `${normalizedInput.first_name} ${normalizedInput.last_name}`.trim()

  const adminSupabase = await createAdminClient()
  const { error } = await (adminSupabase as any)
    .from('children')
    .update({
      id_rolf: normalizedInput.id_rolf.trim().toUpperCase(),
      display_name,
      first_name: normalizedInput.first_name,
      last_name: normalizedInput.last_name,
      birth_year: normalizedInput.birth_year ?? null,
      birth_month: normalizedInput.birth_month ?? null,
      birth_day: normalizedInput.birth_day ?? null,
      year_joined: normalizedInput.year_joined ?? null,
      date_joined: normalizedInput.date_joined ?? null,
      country: normalizedInput.country,
      career_aspiration: normalizedInput.career_aspiration,
      favorite_subject: normalizedInput.favorite_subject,
      hobby: normalizedInput.hobby,
      bio: normalizedInput.bio ?? null,
      notes: normalizedInput.notes ?? null,
      profile_photo: normalizedInput.profile_photo,
      profile_video: normalizedInput.profile_video,
      status: normalizedInput.status,
      edit_log: updatedLog, 
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/children')
  revalidatePath(`/dashboard/children/${id}`)

  return { error: null }
}
