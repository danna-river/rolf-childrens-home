"use server"

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { isAdminRole } from '@/lib/profiles'
import { revalidatePath } from 'next/cache'
import { commitStagedFilesToCountry, moveFileToSystemTrash } from '@/lib/googleDrive'

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
  profile_photo: string | null // Dynamic: handles incoming UUID strings OR staging text fallback URLs
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
  stagedFileIds?: string[]
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
  const adminSupabase = await createAdminClient()

  // 1. Fetch live original child row with relational sub-joins so we can see BOTH raw UUIDs and URLs
  const { data: rawCurrentChild, error: fetchError } = await (supabase as any)
    .from('children')
    .select(`
      *,
      profile_photo:child_media!fk_children_profile_photo(id, url),
      profile_video:child_media!fk_children_profile_video(id, url)
    `)
    .eq('id', id)
    .single()

  if (fetchError || !rawCurrentChild) {
    return { error: "Failed to locate the original child record for delta logging." }
  }

  // Flatten the old values so your audit tracker handles text links instead of raw UUID keys
  const flattenedCurrentChild = {
    ...rawCurrentChild,
    profile_photo: rawCurrentChild.profile_photo?.url ?? null,
    profile_video: rawCurrentChild.profile_video?.url ?? null
  }

  const actorFullName = actorProfile.full_name || 'Unknown User'

  // 2. Track changes for the edit audit log (basic fields only)
  const changes: Array<{ field: string; from: any; to: any }> = []
  const normalizeDate = (val: any) => val ? new Date(val).toISOString().split('T')[0] : null

  const fieldsToTrack: Array<keyof UpdateChildInput> = [
    'id_rolf', 'first_name', 'last_name', 'country',
    'career_aspiration', 'favorite_subject', 'hobby', 'bio', 'notes', 'status',
    'date_joined', 'year_joined', 'birth_year', 'birth_month', 'birth_day'
  ]

  fieldsToTrack.forEach((field) => {
    let currentVal = flattenedCurrentChild[field]
    let newVal = input[field]

    if (typeof currentVal === 'string') currentVal = currentVal.trim() || null
    if (typeof newVal === 'string') newVal = newVal.trim() || null

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

  let finalPhotoUuid = input.profile_photo
  let finalVideoUuid = input.profile_video

  // 3. Operational Media Lifecycle Rotation
  try {
    // --- PROFILE PHOTO PROCESSING ---
    if (!input.profile_photo || input.profile_photo.trim() === '') {
      const oldPhotoId = typeof rawCurrentChild.profile_photo === 'object' ? rawCurrentChild.profile_photo?.id : rawCurrentChild.profile_photo;
      
      if (oldPhotoId) {
        const { data: mediaRow } = await (adminSupabase as any)
          .from('child_media')
          .select('gdrive_file_id')
          .eq('id', oldPhotoId)
          .single()

        if (mediaRow?.gdrive_file_id) {
          try {
            await moveFileToSystemTrash(mediaRow.gdrive_file_id)
          } catch (gDriveErr) {
            console.warn(`External asset bypass: File link ${mediaRow.gdrive_file_id} could not be moved to system trash (external reference). Dereferencing row instead.`)
          }
        }

        await (adminSupabase as any).from('child_media').delete().eq('id', oldPhotoId)
      }
      finalPhotoUuid = null;
    } else if (input.profile_photo.startsWith("https://")) {
      if (rawCurrentChild.profile_photo && typeof rawCurrentChild.profile_photo === 'object' && rawCurrentChild.profile_photo.url === input.profile_photo) {
        finalPhotoUuid = rawCurrentChild.profile_photo.id;
      } else if (rawCurrentChild.profile_photo && typeof rawCurrentChild.profile_photo === 'string') {
        finalPhotoUuid = rawCurrentChild.profile_photo;
      } else {
        const extractedFileId = input.profile_photo.split('/d/')[1]?.split('/')[0] || `photo-${Date.now()}`
        
        const { data: photoMediaRow, error: photoDbErr } = await (adminSupabase as any)
          .from('child_media')
          .insert({
            child_id: id,
            gdrive_file_id: extractedFileId,
            filename: `${input.id_rolf}_profile_photo`,
            url: input.profile_photo,
            media_type: 'photo',
            usage_type: 'profile_picture',
            source: 'direct_upload',
            uploaded_by: actorProfile.id
          })
          .select('id')
          .single()

        if (photoDbErr) throw photoDbErr;
        if (photoMediaRow) finalPhotoUuid = photoMediaRow.id
      }
    } else {
      finalPhotoUuid = input.profile_photo;
    }

    // --- PROFILE VIDEO PROCESSING ---
    if (!input.profile_video || input.profile_video.trim() === '') {
      const oldVideoId = typeof rawCurrentChild.profile_video === 'object' ? rawCurrentChild.profile_video?.id : rawCurrentChild.profile_video;

      if (oldVideoId) {
        const { data: mediaRow } = await (adminSupabase as any)
          .from('child_media')
          .select('gdrive_file_id')
          .eq('id', oldVideoId)
          .single()

        if (mediaRow?.gdrive_file_id) {
          try {
            await moveFileToSystemTrash(mediaRow.gdrive_file_id)
          } catch (gDriveErr) {
            console.warn(`External asset bypass: File link ${mediaRow.gdrive_file_id} could not be moved to system trash. Dereferencing instead.`)
          }
        }

        await (adminSupabase as any).from('child_media').delete().eq('id', oldVideoId)
      }
      finalVideoUuid = null;
    } else if (input.profile_video.startsWith("https://")) {
      if (rawCurrentChild.profile_video && typeof rawCurrentChild.profile_video === 'object' && rawCurrentChild.profile_video.url === input.profile_video) {
        finalVideoUuid = rawCurrentChild.profile_video.id;
      } else if (rawCurrentChild.profile_video && typeof rawCurrentChild.profile_video === 'string') {
        finalVideoUuid = rawCurrentChild.profile_video;
      } else {
        const extractedFileId = input.profile_video.split('/d/')[1]?.split('/')[0] || `video-${Date.now()}`
        
        const { data: videoMediaRow, error: videoDbErr } = await (adminSupabase as any)
          .from('child_media')
          .insert({
            child_id: id,
            gdrive_file_id: extractedFileId,
            filename: `${input.id_rolf}_profile_video`,
            url: input.profile_video,
            media_type: 'video',
            usage_type: 'profile_video',
            source: 'direct_upload',
            uploaded_by: actorProfile.id
          })
          .select('id')
          .single()

        if (videoDbErr) throw videoDbErr;
        if (videoMediaRow) finalVideoUuid = videoMediaRow.id
      }
    } else {
      finalVideoUuid = input.profile_video;
    }

    // Flip legacy indicators to history tracks if true modifications exist
    const oldPhotoId = typeof rawCurrentChild.profile_photo === 'object' ? rawCurrentChild.profile_photo?.id : rawCurrentChild.profile_photo;
    const oldVideoId = typeof rawCurrentChild.profile_video === 'object' ? rawCurrentChild.profile_video?.id : rawCurrentChild.profile_video;

    if (oldPhotoId && finalPhotoUuid && oldPhotoId !== finalPhotoUuid) {
      await (adminSupabase as any)
        .from('child_media')
        .update({ usage_type: 'past_profile_picture' })
        .eq('child_id', id)
        .eq('usage_type', 'profile_picture')
        .neq('id', finalPhotoUuid)
    }
    if (oldVideoId && finalVideoUuid && oldVideoId !== finalVideoUuid) {
      await (adminSupabase as any)
        .from('child_media')
        .update({ usage_type: 'past_profile_video' })
        .eq('child_id', id)
        .eq('usage_type', 'profile_video')
        .neq('id', finalVideoUuid)
    }
  } catch (mediaError: any) {
    console.error("Media registry synchronization failure:", mediaError)
    return { error: `Media alignment error: ${mediaError.message}` }
  }

  // 4. Safely log media adjustments to changes ledger using verified database UUID identifiers
  if (rawCurrentChild.profile_photo !== finalPhotoUuid) {
    changes.push({
      field: 'profile_photo',
      from: rawCurrentChild.profile_photo ?? '—',
      to: finalPhotoUuid ?? '—'
    })
  }
  if (rawCurrentChild.profile_video !== finalVideoUuid) {
    changes.push({
      field: 'profile_video',
      from: rawCurrentChild.profile_video ?? '—',
      to: finalVideoUuid ?? '—'
    })
  }

  let updatedLog = rawCurrentChild.edit_log || []
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

  // 5. ATOMIC DRIVE MIGRATE: Pull confirmed new files out of SYSTEM_TRASH staging
  if (stagedFileIds && stagedFileIds.length > 0) {
    await commitStagedFilesToCountry(input.country, stagedFileIds)
  }

  // 6. Update core child profile table attributes
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
      profile_photo: finalPhotoUuid, 
      profile_video: finalVideoUuid, 
      status: input.status,
      edit_log: updatedLog, 
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/children')
  revalidatePath(`/dashboard/children/${id}`)

  return { error: null }
}