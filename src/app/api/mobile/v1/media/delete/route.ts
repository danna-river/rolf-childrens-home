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

export const runtime = 'nodejs'
export const maxDuration = 60

const deleteSchema = z.object({
  device_installation_id: z.string().trim().min(3).max(200),
  op_id: z.string().trim().min(3).max(200),
  media_id: z.string().uuid(),
}).strict()

/**
 * Offline counterpart of deleteLibraryItemAction: clears intake answers that
 * reference the file, clears the child's profile slot if assigned, moves the
 * Drive file to system trash (best effort), and drops the child_media row.
 * A media id that no longer exists reports success so mobile retries settle
 * instead of failing forever on an already-applied delete.
 */
export async function POST(request: NextRequest) {
  try {
    const input = deleteSchema.parse(await request.json())
    const context = await authenticateMobileDevice(request, input.device_installation_id)
    const admin = createAdminClient()

    const { data: media, error: mediaError } = await admin
      .from('child_media')
      .select('id, child_id, gdrive_file_id')
      .eq('id', input.media_id)
      .maybeSingle()
    if (mediaError) throw new Error(`Could not read media for deletion: ${mediaError.message}`)
    if (!media) return mobileJson({ applied: true })

    const { data: child, error: childError } = await admin
      .from('children')
      .select('id, country, profile_photo, profile_video')
      .eq('id', media.child_id)
      .maybeSingle()
    if (childError) throw new Error(`Could not read child for media deletion: ${childError.message}`)
    if (!child) throw new MobileApiError(404, 'child_not_found', 'The child no longer exists.')
    assertCountryScope(context, child.country)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- report_answers is not in the generated Database schema yet.
    const { error: clearAnswerError } = await (admin as any)
      .from('report_answers')
      .update({ answer_value: '' })
      .eq('answer_value', media.id)
    if (clearAnswerError) {
      console.error('[mobile-api] failed to clear intake answers for deleted media', clearAnswerError.message)
    }

    if (child.profile_photo === media.id) {
      const { error } = await admin.from('children').update({ profile_photo: null }).eq('id', child.id)
      if (error) throw new Error(`Could not clear the profile photo slot: ${error.message}`)
    }
    if (child.profile_video === media.id) {
      const { error } = await admin.from('children').update({ profile_video: null }).eq('id', child.id)
      if (error) throw new Error(`Could not clear the profile video slot: ${error.message}`)
    }

    if (media.gdrive_file_id) {
      const { moveFileToSystemTrash } = await import('@/lib/googleDrive')
      try {
        await moveFileToSystemTrash(media.gdrive_file_id)
      } catch {
        console.warn(`[mobile-api] Drive trash skipped for file ${media.gdrive_file_id}`)
      }
    }

    const { error: deleteError } = await admin.from('child_media').delete().eq('id', media.id)
    if (deleteError) throw new Error(`Could not delete the media record: ${deleteError.message}`)

    return mobileJson({ applied: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileJson({ error: { code: 'invalid_media_delete_request', message: 'The media deletion request is invalid.' } }, { status: 400 })
    }
    return mobileErrorResponse(error)
  }
}
