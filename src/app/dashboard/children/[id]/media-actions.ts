"use server"

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth'
import { isAdminRole, isStaffRole } from '@/lib/profiles'
import { revalidatePath } from 'next/cache'
import { recalculateProfileComplete } from './intake-actions'

function canManageChildCountry(profile: { role: string; country: string[] | null }, country: string | null): boolean {
    if (isAdminRole(profile.role)) return true
    return isStaffRole(profile.role) && Boolean(country && (profile.country ?? []).includes(country))
}

export async function setProfileMediaAction(childId: string, mediaId: string, mediaType: 'photo' | 'video') {
    const { profile } = await requireAuth()
    if (!isAdminRole(profile.role) && !isStaffRole(profile.role)) {
        return { error: "Unauthorized" }
    }
    if (mediaType !== 'photo' && mediaType !== 'video') {
        return { error: "Unauthorized" }
    }

    const adminSupabase = await createAdminClient()

    const { data: childData, error: childErr } = await adminSupabase
        .from('children')
        .select('country, profile_photo, profile_video')
        .eq('id', childId)
        .single()

    if (childErr || !childData) return { error: "Failed to locate child." }
    if (!canManageChildCountry(profile, childData.country)) {
        return { error: "Unauthorized" }
    }

    const { data: mediaData, error: mediaErr } = await adminSupabase
        .from('child_media')
        .select('child_id, media_type')
        .eq('id', mediaId)
        .maybeSingle()

    if (
        mediaErr ||
        !mediaData ||
        mediaData.child_id !== childId ||
        mediaData.media_type !== mediaType
    ) {
        return { error: "Unauthorized" }
    }

    const isPhoto = mediaType === 'photo'
    const oldMediaId = isPhoto ? childData.profile_photo : childData.profile_video
    const targetUsageType = isPhoto ? 'profile_picture' : 'profile_video'

    try {
        // 1. Demote old media using ADMIN client
        if (oldMediaId && oldMediaId !== mediaId) {
            const { error: demoteErr } = await adminSupabase
                .from('child_media')
                .update({ usage_type: 'library' })
                .eq('id', oldMediaId)
                .eq('child_id', childId)
            
            if (demoteErr) throw new Error(`Demote fail: ${demoteErr.message}`)
        }

        // 2. Promote new media using ADMIN client
        const { error: promoteErr } = await adminSupabase
            .from('child_media')
            .update({ usage_type: targetUsageType })
            .eq('id', mediaId)
            .eq('child_id', childId)

        if (promoteErr) throw new Error(`Promote fail: ${promoteErr.message}`)

        // 3. Update children table 
        const updatePayload = isPhoto ? { profile_photo: mediaId } : { profile_video: mediaId }
        const { error: updateErr } = await adminSupabase
            .from('children')
            .update(updatePayload)
            .eq('id', childId)

        if (updateErr) throw new Error(`Children update fail: ${updateErr.message}`)

        await recalculateProfileComplete(childId)

        revalidatePath(`/dashboard/children/${childId}`)
        return { error: null }
    } catch (err) {
        return { error: err instanceof Error ? err.message : "An unexpected error occurred." }
    }
}
