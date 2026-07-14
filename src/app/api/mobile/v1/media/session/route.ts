import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  assertCountryScope,
  authenticateMobileDevice,
  mobileErrorResponse,
  mobileJson,
} from '@/app/api/mobile/v1/_lib/auth'
import { createMobileDriveUploadSession, type MobileMediaType } from '@/lib/googleDriveMobile'

export const runtime = 'nodejs'
export const maxDuration = 60

const sessionSchema = z.object({
  device_installation_id: z.string().trim().min(3).max(200),
  child_id: z.string().uuid(),
  filename: z.string().trim().min(1).max(255),
  mime_type: z.string().trim().min(3).max(255),
  total_bytes: z.number().int().positive().max(50 * 1024 * 1024),
  usage_type: z.enum(['profile_picture', 'profile_video', 'library']).default('library'),
}).strict()

function mediaTypeFor(mimeType: string): MobileMediaType | null {
  if (mimeType.startsWith('image/')) return 'photo'
  if (mimeType.startsWith('video/')) return 'video'
  return null
}

export async function POST(request: NextRequest) {
  try {
    const input = sessionSchema.parse(await request.json())
    const context = await authenticateMobileDevice(request, input.device_installation_id)
    const mediaType = mediaTypeFor(input.mime_type)
    if (!mediaType) {
      return mobileJson({ error: { code: 'invalid_media_type', message: 'Only images and videos can be uploaded.' } }, { status: 400 })
    }
    if (
      (input.usage_type === 'profile_picture' && mediaType !== 'photo') ||
      (input.usage_type === 'profile_video' && mediaType !== 'video')
    ) {
      return mobileJson({ error: { code: 'invalid_media_usage', message: 'The requested profile media type does not match the file.' } }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: child, error: childError } = await admin
      .from('children')
      .select('id, id_rolf, first_name, last_name, country')
      .eq('id', input.child_id)
      .maybeSingle()
    if (childError) throw new Error(`Could not read child for media upload: ${childError.message}`)
    if (!child) return mobileJson({ error: { code: 'child_not_found', message: 'The child must sync before media can upload.' } }, { status: 404 })
    assertCountryScope(context, child.country)

    const driveUploadUrl = await createMobileDriveUploadSession({
      type: mediaType,
      filename: input.filename,
      mimeType: input.mime_type,
      size: input.total_bytes,
      meta: {
        idRolf: child.id_rolf,
        firstName: child.first_name,
        lastName: child.last_name,
        country: child.country,
      },
    })

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const { data: upload, error: uploadError } = await admin
      .from('mobile_media_uploads')
      .insert({
        device_id: context.device.id,
        user_id: context.userId,
        child_id: child.id,
        filename: input.filename,
        mime_type: input.mime_type,
        media_type: mediaType,
        usage_type: input.usage_type,
        total_bytes: input.total_bytes,
        drive_upload_url: driveUploadUrl,
        status: 'uploading',
        expires_at: expiresAt,
      })
      .select('id, expires_at')
      .single()

    if (uploadError || !upload) {
      throw new Error(`Could not record mobile media upload: ${uploadError?.message ?? 'No upload returned.'}`)
    }

    return mobileJson({
      upload_id: upload.id,
      chunk_size_bytes: 4 * 1024 * 1024,
      next_offset: 0,
      expires_at: upload.expires_at,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileJson({ error: { code: 'invalid_media_session_request', message: 'The media session request is invalid.' } }, { status: 400 })
    }
    return mobileErrorResponse(error)
  }
}
