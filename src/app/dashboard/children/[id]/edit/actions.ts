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

  // 1. Fetch current child record to compare deltas and find existing media links
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

  // 2. Track changes for the edit audit log
  const changes: Array<{ field: string; from: any; to: any }> = []
  const normalizeDate = (val: any) => val ? new Date(val).toISOString().split('T')[0] : null

  const fieldsToTrack: Array<keyof UpdateChildInput> = [
    'id_rolf', 'first_name', 'last_name', 'country',
    'career_aspiration', 'favorite_subject', 'hobby', 'bio', 'notes', 'status',
    'date_joined', 'year_joined', 'birth_year', 'birth_month', 'birth_day',
    'profile_photo', 'profile_video'
  ]

  fieldsToTrack.forEach((field) => {
    let currentVal = currentChild[field]
    let newVal = input[field]

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

  const display_name = `${input.first_name} ${input.last_name}`.trim()
  const adminSupabase = await createAdminClient()

  // 3. Operational Media Lifecycle Rotation (Preserving Historical Context Labels)
  try {
    // A. Track Profile Photo Changes
    if (currentChild.profile_photo !== input.profile_photo) {
      // Archive the old profile picture, maintaining its specific contextual identity label
      await (adminSupabase as any)
        .from('child_media')
        .update({ usage_type: 'past_profile_picture' })
        .eq('child_id', id)
        .eq('usage_type', 'profile_picture')

      if (input.profile_photo) {
        const { data: existingMedia } = await (adminSupabase as any)
          .from('child_media')
          .select('id')
          .eq('url', input.profile_photo)
          .maybeSingle()

        if (existingMedia) {
          await (adminSupabase as any)
            .from('child_media')
            .update({ usage_type: 'profile_picture' })
            .eq('id', existingMedia.id)
        } else {
          const extractedId = input.profile_photo.split('/d/')[1]?.split('/')[0] || `manual-${Date.now()}`
          await (adminSupabase as any)
            .from('child_media')
            .insert({
              child_id: id,
              gdrive_file_id: extractedId,
              filename: `${input.id_rolf || 'CHILD'}_pasted_photo_${Date.now()}`,
              url: input.profile_photo,
              media_type: 'photo',
              usage_type: 'profile_picture',
              source: 'direct_upload',
              uploaded_by: actorProfile.id
            })
        }
      }
    }

    // B. Track Profile Video Changes
    if (currentChild.profile_video !== input.profile_video) {
      // Archive the old profile video safely under a distinct historic category flag
      await (adminSupabase as any)
        .from('child_media')
        .update({ usage_type: 'past_profile_video' })
        .eq('child_id', id)
        .eq('usage_type', 'profile_video')

      if (input.profile_video) {
        const { data: existingVideo } = await (adminSupabase as any)
          .from('child_media')
          .select('id')
          .eq('url', input.profile_video)
          .maybeSingle()

        if (existingVideo) {
          await (adminSupabase as any)
            .from('child_media')
            .update({ usage_type: 'profile_video' })
            .eq('id', existingVideo.id)
        } else {
          const extractedId = input.profile_video.split('/d/')[1]?.split('/')[0] || `manual-${Date.now()}`
          await (adminSupabase as any)
            .from('child_media')
            .insert({
              child_id: id,
              gdrive_file_id: extractedId,
              filename: `${input.id_rolf || 'CHILD'}_pasted_video_${Date.now()}`,
              url: input.profile_video,
              media_type: 'video',
              usage_type: 'profile_video',
              source: 'direct_upload',
              uploaded_by: actorProfile.id
            })
        }
      }
    }
  } catch (mediaError: any) {
    console.error("Media registry synchronization failure:", mediaError)
    return { error: `Media alignment error: ${mediaError.message}` }
  }

  // 4. Update core child profile table attributes (storing raw Drive links in the row)
  const { error } = await (adminSupabase as any)
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
      edit_log: updatedLog, 
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/children')
  revalidatePath(`/dashboard/children/${id}`)

  return { error: null }
}