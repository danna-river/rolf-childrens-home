"use server"

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin' // ⚡ IMPORT ADMIN
import { revalidatePath } from 'next/cache'

export async function setProfileMediaAction(childId: string, mediaId: string, mediaType: 'photo' | 'video') {
    const supabase = await createClient()
    const adminSupabase = await createAdminClient() // ⚡ USE ADMIN CLIENT FOR MEDIA

    const { data: childData, error: childErr } = await supabase
        .from('children')
        .select('profile_photo, profile_video')
        .eq('id', childId)
        .single()

    if (childErr || !childData) return { error: "Failed to locate child." }

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
            
            if (demoteErr) throw new Error(`Demote fail: ${demoteErr.message}`)
        }

        // 2. Promote new media using ADMIN client
        const { error: promoteErr } = await adminSupabase
            .from('child_media')
            .update({ usage_type: targetUsageType })
            .eq('id', mediaId)

        if (promoteErr) throw new Error(`Promote fail: ${promoteErr.message}`)

        // 3. Update children table (User client is fine here if they have RLS for this)
        const updatePayload = isPhoto ? { profile_photo: mediaId } : { profile_video: mediaId }
        const { error: updateErr } = await supabase
            .from('children')
            .update(updatePayload)
            .eq('id', childId)

        if (updateErr) throw new Error(`Children update fail: ${updateErr.message}`)

        revalidatePath(`/dashboard/children/${childId}`)
        return { error: null }
    } catch (err: any) {
        return { error: err.message }
    }
}