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

const assignSchema = z.object({
  device_installation_id: z.string().trim().min(3).max(200),
  op_id: z.string().trim().min(3).max(200),
  child_id: z.string().uuid(),
  media_id: z.string().uuid(),
  media_type: z.enum(['photo', 'video']),
}).strict()

/**
 * Offline counterpart of setProfileMediaAction: promotes one of the child's
 * library items to their profile photo/video. Idempotent — re-assigning the
 * current profile media is a no-op success, so mobile retries stay safe.
 */
export async function POST(request: NextRequest) {
  try {
    const input = assignSchema.parse(await request.json())
    const context = await authenticateMobileDevice(request, input.device_installation_id)
    const admin = createAdminClient()

    const { data: child, error: childError } = await admin
      .from('children')
      .select('id, country, profile_photo, profile_video')
      .eq('id', input.child_id)
      .maybeSingle()
    if (childError) throw new Error(`Could not read child for media assignment: ${childError.message}`)
    if (!child) throw new MobileApiError(404, 'child_not_found', 'The child no longer exists.')
    assertCountryScope(context, child.country)

    const { data: media, error: mediaError } = await admin
      .from('child_media')
      .select('id, child_id, media_type')
      .eq('id', input.media_id)
      .maybeSingle()
    if (mediaError) throw new Error(`Could not read media for assignment: ${mediaError.message}`)
    if (!media || media.child_id !== input.child_id || media.media_type !== input.media_type) {
      throw new MobileApiError(403, 'unauthorized', 'Unauthorized')
    }

    const isPhoto = input.media_type === 'photo'
    const targetUsageType = isPhoto ? 'profile_picture' : 'profile_video'
    const oldMediaId = isPhoto ? child.profile_photo : child.profile_video

    if (oldMediaId && oldMediaId !== media.id) {
      const { error: demoteError } = await admin
        .from('child_media')
        .update({ usage_type: 'library' })
        .eq('id', oldMediaId)
        .eq('child_id', input.child_id)
      if (demoteError) throw new Error(`Could not release the old profile media: ${demoteError.message}`)
    }

    const { error: promoteError } = await admin
      .from('child_media')
      .update({ usage_type: targetUsageType })
      .eq('id', media.id)
      .eq('child_id', input.child_id)
    if (promoteError) throw new Error(`Could not promote the profile media: ${promoteError.message}`)

    const { error: childUpdateError } = await admin
      .from('children')
      .update(isPhoto ? { profile_photo: media.id } : { profile_video: media.id })
      .eq('id', input.child_id)
    if (childUpdateError) throw new Error(`Could not update the child profile slot: ${childUpdateError.message}`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rpc is not in the generated Database schema yet.
    const { error: recalcError } = await (admin as any)
      .rpc('recalculate_profile_complete', { target_child_id: input.child_id })
    if (recalcError) console.error('[mobile-api] recalculate_profile_complete failed', recalcError.message)

    return mobileJson({ applied: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileJson({ error: { code: 'invalid_media_assign_request', message: 'The media assignment request is invalid.' } }, { status: 400 })
    }
    return mobileErrorResponse(error)
  }
}
