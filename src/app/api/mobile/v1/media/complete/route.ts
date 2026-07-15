import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  assertCountryScope,
  authenticateMobileDevice,
  MobileApiError,
  mobileErrorResponse,
  mobileJson,
} from '@/app/api/mobile/v1/_lib/auth'
import { commitMobileDriveUpload, completeMobileDriveUpload } from '@/lib/googleDriveMobile'

export const runtime = 'nodejs'
export const maxDuration = 60

const completeSchema = z.object({
  device_installation_id: z.string().trim().min(3).max(200),
  upload_id: z.string().uuid(),
}).strict()

export async function POST(request: NextRequest) {
  try {
    const input = completeSchema.parse(await request.json())
    const context = await authenticateMobileDevice(request, input.device_installation_id)
    const admin = createAdminClient()
    const { data: upload, error: uploadError } = await admin
      .from('mobile_media_uploads')
      .select('*')
      .eq('id', input.upload_id)
      .eq('device_id', context.device.id)
      .eq('user_id', context.userId)
      .maybeSingle()
    if (uploadError) throw new Error(`Could not read mobile media upload: ${uploadError.message}`)
    if (!upload) throw new MobileApiError(404, 'upload_not_found', 'The media upload was not found for this device.')
    if (upload.status === 'completed' && upload.child_media_id) {
      return mobileJson({ upload_id: upload.id, completed: true, media_id: upload.child_media_id })
    }
    if (upload.status !== 'uploaded' || !upload.gdrive_file_id) {
      throw new MobileApiError(409, 'upload_incomplete', 'All media chunks must finish before completing the upload.')
    }

    const { data: child, error: childError } = await admin
      .from('children')
      .select('id, country, profile_photo, profile_video')
      .eq('id', upload.child_id)
      .maybeSingle()
    if (childError) throw new Error(`Could not read child for media completion: ${childError.message}`)
    if (!child) throw new MobileApiError(404, 'child_not_found', 'The child no longer exists.')
    assertCountryScope(context, child.country)

    const driveUrl = await completeMobileDriveUpload(upload.gdrive_file_id)
    const { data: existingMedia, error: existingMediaError } = await admin
      .from('child_media')
      .select('id, url')
      .eq('gdrive_file_id', upload.gdrive_file_id)
      .maybeSingle()
    if (existingMediaError) throw new Error(`Could not inspect completed Drive media: ${existingMediaError.message}`)

    let media = existingMedia
    if (!media) {
      const { data: insertedMedia, error: insertMediaError } = await admin
        .from('child_media')
        .insert({
          child_id: child.id,
          gdrive_file_id: upload.gdrive_file_id,
          filename: upload.filename,
          url: driveUrl,
          media_type: upload.media_type,
          usage_type: upload.usage_type,
          source: 'mobile_offline',
          uploaded_by: context.userId,
        })
        .select('id, url')
        .single()
      if (insertMediaError) throw new Error(`Could not create child media: ${insertMediaError.message}`)
      media = insertedMedia
    }

    if (!media) throw new Error('Could not create the child media record.')

    if (upload.usage_type === 'profile_picture') {
      const { error: libraryError } = await admin
        .from('child_media')
        .update({ usage_type: 'library' })
        .eq('child_id', child.id)
        .eq('usage_type', 'profile_picture')
        .neq('id', media.id)
      if (libraryError) throw new Error(`Could not release the old profile picture: ${libraryError.message}`)

      const { error: profileError } = await admin
        .from('children')
        .update({ profile_photo: media.id })
        .eq('id', child.id)
      if (profileError) throw new Error(`Could not set the profile picture: ${profileError.message}`)
    }

    if (upload.usage_type === 'profile_video') {
      const { error: libraryError } = await admin
        .from('child_media')
        .update({ usage_type: 'library' })
        .eq('child_id', child.id)
        .eq('usage_type', 'profile_video')
        .neq('id', media.id)
      if (libraryError) throw new Error(`Could not release the old profile video: ${libraryError.message}`)

      const { error: profileError } = await admin
        .from('children')
        .update({ profile_video: media.id })
        .eq('id', child.id)
      if (profileError) throw new Error(`Could not set the profile video: ${profileError.message}`)
    }

    // Keep retrying this action safe: when a later step failed, the existing
    // child_media row is reused rather than creating a duplicate Drive record.
    await commitMobileDriveUpload(child.country, upload.gdrive_file_id)

    const { error: completeError } = await admin
      .from('mobile_media_uploads')
      .update({
        child_media_id: media.id,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', upload.id)
    if (completeError) throw new Error(`Could not mark media upload complete: ${completeError.message}`)

    return mobileJson({ upload_id: upload.id, completed: true, media_id: media.id, url: media.url })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileJson({ error: { code: 'invalid_media_complete_request', message: 'The media completion request is invalid.' } }, { status: 400 })
    }
    return mobileErrorResponse(error)
  }
}
