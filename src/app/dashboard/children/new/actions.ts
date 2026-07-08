"use server"

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { ageFromBirthParts, ensureBioIncludesAgeAndCountry, homeDurationFromDate } from '@/lib/bio'
import { isAdminRole } from '@/lib/profiles'
import { revalidatePath } from 'next/cache'

export type RegisterChildInput = {
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
  profile_photo?: string | null
  profile_video?: string | null
}

export async function getLatestIdPreview(countryName: string): Promise<{ previewId: string | null; error: string | null }> {
  const supabase = await createClient()

  const { data: countryRecord } = await (supabase as any)
    .from('countries')
    .select('iso_code')
    .eq('name', countryName.trim())
    .single()

  if (!countryRecord) return { previewId: null, error: "Country not configured." }
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

  return {
    previewId: `${prefix}-${String(currentMaxNumber + 1).padStart(4, '0')}`,
    error: null
  }
}

export async function checkRolfIdForRegistration(
  idRolf: string,
  countryName: string
): Promise<{ isValid: boolean; error: string | null }> {
  const supabase = await createClient()
  const adminSupabase = await createAdminClient()

  const { data: countryData } = await (supabase as any)
    .from('countries')
    .select('iso_code')
    .eq('name', countryName.trim())
    .single()

  if (!countryData) {
    return { isValid: false, error: `Country configuration mapping parameters for "${countryName}" could not be found.` }
  }

  const prefix = countryData.iso_code
  const targetId = idRolf.trim().toUpperCase()

  const strictFormatRegex = new RegExp(`^${prefix}-\\d{4}$`)

  if (!strictFormatRegex.test(targetId)) {
    return {
      isValid: false,
      error: `Format Mismatch: The ROLF ID must match the exact country format layout (${prefix}-XXXX) with exactly 4 digits.`
    }
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

  const supabase = await createClient()
  const adminSupabase = await createAdminClient()

  const { data: countryRecord, error: countryError } = await (supabase as any)
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
    return { id: null, error: `Identity Collision: The ROLF ID "${targetRolfId}" was claimed by another worker while you filled out the form.` }
  }

  const display_name = `${input.first_name} ${input.last_name}`.trim()

  const normalizedBio = input.bio
    ? ensureBioIncludesAgeAndCountry(input.bio, {
        age: ageFromBirthParts(input.birth_year, input.birth_month, input.birth_day),
        country: input.country,
        homeDuration: homeDurationFromDate(input.date_joined ?? (input.year_joined ? `${input.year_joined}-01-01` : null)),
      })
    : null

  // ⚡ 1. INSERT BASE CHILD PROFILE FIRST (Set media links to null temporarily to bypass FK constraints)
  const { data: insertedChild, error: insertError } = await (supabase as any)
    .from('children')
    .insert({
      id_rolf: targetRolfId,
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
      bio: normalizedBio,
      notes: input.notes ?? null,
      profile_photo: null,  // 👈 Nullified initial link fields
      profile_video: null,  // 👈 Nullified initial link fields
      status: 'active',
      edit_log: [],
      created_by: user.id
    })
    .select('id')
    .single()

  if (insertError || !insertedChild) return { id: null, error: insertError?.message || "Failed to create profile row." }
  
  const childId = insertedChild.id
  let finalPhotoUuid: string | null = null
  let finalVideoUuid: string | null = null

  // ⚡ 2. INJECT ASSETS INTO CHILD_MEDIA NOW THAT WE HAVE A GUARANTEED NON-NULL CHILD_ID
  try {
    if (input.profile_photo && input.profile_photo.startsWith("https://")) {
      const extractedFileId = input.profile_photo.split('/d/')[1]?.split('/')[0] || `photo-${Date.now()}`
      
      const { data: photoMediaRow } = await (adminSupabase as any)
        .from('child_media')
        .insert({
          child_id: childId,
          gdrive_file_id: extractedFileId,
          filename: `${targetRolfId}_profile_photo`,
          url: input.profile_photo,
          media_type: 'photo',
          usage_type: 'profile_picture',
          source: 'direct_upload',
          uploaded_by: profile.id
        })
        .select('id')
        .single()

      if (photoMediaRow) finalPhotoUuid = photoMediaRow.id
    }

    if (input.profile_video && input.profile_video.startsWith("https://")) {
      const extractedFileId = input.profile_video.split('/d/')[1]?.split('/')[0] || `video-${Date.now()}`
      
      const { data: videoMediaRow } = await (adminSupabase as any)
        .from('child_media')
        .insert({
          child_id: childId,
          gdrive_file_id: extractedFileId,
          filename: `${targetRolfId}_profile_video`,
          url: input.profile_video,
          media_type: 'video',
          usage_type: 'profile_video',
          source: 'direct_upload',
          uploaded_by: profile.id
        })
        .select('id')
        .single()

      if (videoMediaRow) finalVideoUuid = videoMediaRow.id
    }

    // ⚡ 3. BACKFILL THE NEWLY PRODUCED UUID CODES STRAIGHT INTO THE CHILD ROW
    if (finalPhotoUuid || finalVideoUuid) {
      await (adminSupabase as any)
        .from('children')
        .update({
          profile_photo: finalPhotoUuid,
          profile_video: finalVideoUuid
        })
        .eq('id', childId)
    }
  } catch (mediaError: any) {
    console.error("Failed to commit secondary registration media dependencies:", mediaError)
  }

  revalidatePath('/dashboard/children')

  return { id: childId, error: null, generatedId: targetRolfId }
}
