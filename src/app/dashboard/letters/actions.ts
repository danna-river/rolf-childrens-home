"use server"

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { isAdminRole, isDonorRole, isStaffRole } from '@/lib/profiles'
import { createAdminClient } from '@/lib/supabase/admin'
import { MAX_LETTER_CHARS } from '@/lib/penpal'
import type { PenPalMessageStatus } from '@/lib/types'

// ---------------------------------------------------------------------------
// Donor-safe shapes. pen_pal_messages holds raw drafts, staff notes, and
// moderation metadata — donors only ever receive these narrowed objects,
// never table rows.
// ---------------------------------------------------------------------------

export type DonorLetter = {
  id: string
  /** Donor's own letters: what they wrote. Child replies: approved text only. */
  body: string
  direction: 'sent' | 'received'
  /** Donor-facing status label for their own letters. */
  status: 'in_review' | 'delivered' | 'not_shared'
  createdAt: string
}

function donorStatus(status: PenPalMessageStatus): DonorLetter['status'] {
  if (status === 'delivered') return 'delivered'
  if (status === 'rejected') return 'not_shared'
  return 'in_review'
}

async function logEvent(
  admin: ReturnType<typeof createAdminClient>,
  event: {
    thread_id: string
    message_id?: string | null
    actor_profile_id: string | null
    event_type: string
    notes?: string | null
  },
) {
  const { error } = await admin.from('pen_pal_events').insert(event)
  if (error) console.error('[penpal] event log failed:', error.message)
}

/** Donor gate: returns the sponsor record + active sponsorship for this child, or null. */
async function donorSponsorshipForChild(
  admin: ReturnType<typeof createAdminClient>,
  profileId: string,
  childId: string,
) {
  const { data: sponsor } = await admin
    .from('sponsors')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle()
  if (!sponsor) return null

  const { data: sponsorship } = await admin
    .from('sponsorships')
    .select('id, sponsor_id, child_id')
    .eq('sponsor_id', sponsor.id)
    .eq('child_id', childId)
    .eq('status', 'active')
    .maybeSingle()
  if (!sponsorship) return null

  return { sponsorId: sponsor.id, sponsorshipId: sponsorship.id }
}

// ---------------------------------------------------------------------------
// Donor actions
// ---------------------------------------------------------------------------

export async function submitPenPalLetter(childId: string, body: string) {
  const { user, profile } = await requireAuth()
  if (!isDonorRole(profile.role)) return { error: 'Only donors can send letters.' }

  const text = body.trim()
  if (!text) return { error: 'The letter cannot be empty.' }
  if (text.length > MAX_LETTER_CHARS) {
    return { error: `Letters are limited to ${MAX_LETTER_CHARS} characters.` }
  }

  const admin = createAdminClient()
  const link = await donorSponsorshipForChild(admin, user.id, childId)
  if (!link) return { error: 'You can only write to a child you actively sponsor.' }

  // Find or create the thread for this sponsorship.
  let threadId: string
  const { data: existing } = await admin
    .from('pen_pal_threads')
    .select('id, status')
    .eq('sponsorship_id', link.sponsorshipId)
    .maybeSingle()

  if (existing) {
    if (existing.status !== 'active') return { error: 'This letter thread is closed.' }
    threadId = existing.id
  } else {
    const { data: thread, error: threadError } = await admin
      .from('pen_pal_threads')
      .insert({
        sponsorship_id: link.sponsorshipId,
        sponsor_id: link.sponsorId,
        child_id: childId,
      })
      .select('id')
      .single()
    if (threadError) return { error: threadError.message }
    threadId = thread.id
    await logEvent(admin, {
      thread_id: threadId,
      actor_profile_id: user.id,
      event_type: 'thread_created',
    })
  }

  const { data: message, error: messageError } = await admin
    .from('pen_pal_messages')
    .insert({
      thread_id: threadId,
      direction: 'donor_to_child',
      status: 'submitted',
      raw_body: text,
      author_profile_id: user.id,
    })
    .select('id')
    .single()
  if (messageError) return { error: messageError.message }

  await admin
    .from('pen_pal_threads')
    .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', threadId)

  await logEvent(admin, {
    thread_id: threadId,
    message_id: message.id,
    actor_profile_id: user.id,
    event_type: 'letter_submitted',
  })

  revalidatePath('/dashboard/letters')
  revalidatePath(`/dashboard/letters/${threadId}`)
  return { success: true }
}

/** Donor-safe letter history for one sponsored child. */
export async function getDonorLetters(childId: string): Promise<{ letters: DonorLetter[]; error: string | null }> {
  const { user, profile } = await requireAuth()
  if (!isDonorRole(profile.role)) return { letters: [], error: 'Unauthorized' }

  const admin = createAdminClient()

  // The donor may read history even after a sponsorship ends, but only their own.
  const { data: sponsor } = await admin
    .from('sponsors')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()
  if (!sponsor) return { letters: [], error: null }

  const { data: thread } = await admin
    .from('pen_pal_threads')
    .select('id')
    .eq('sponsor_id', sponsor.id)
    .eq('child_id', childId)
    .maybeSingle()
  if (!thread) return { letters: [], error: null }

  const { data: rows, error } = await admin
    .from('pen_pal_messages')
    .select('id, direction, status, raw_body, approved_body, created_at, published_at')
    .eq('thread_id', thread.id)
    .order('created_at', { ascending: true })
  if (error) return { letters: [], error: error.message }

  const letters: DonorLetter[] = []
  for (const row of rows ?? []) {
    if (row.direction === 'donor_to_child') {
      letters.push({
        id: row.id,
        body: row.raw_body,
        direction: 'sent',
        status: donorStatus(row.status),
        createdAt: row.created_at,
      })
    } else if (row.status === 'published' && row.approved_body) {
      // Child replies are visible ONLY once published, and only the approved text.
      letters.push({
        id: row.id,
        body: row.approved_body,
        direction: 'received',
        status: 'delivered',
        createdAt: row.published_at ?? row.created_at,
      })
    }
  }
  return { letters, error: null }
}

// ---------------------------------------------------------------------------
// Staff / admin actions
// ---------------------------------------------------------------------------

async function verifyStaffGate() {
  const { user, profile } = await requireAuth()
  if (!isAdminRole(profile.role) && !isStaffRole(profile.role)) {
    throw new Error('Unauthorized: staff clearance required.')
  }
  return { user, profile }
}

/** Staff country scoping: throws unless the message's child is in the staff member's countries. */
async function assertMessageInScope(
  admin: ReturnType<typeof createAdminClient>,
  messageId: string,
  profile: { role: string; country: string[] | null },
) {
  const { data: message } = await admin
    .from('pen_pal_messages')
    .select('id, thread_id, direction, status, raw_body')
    .eq('id', messageId)
    .maybeSingle()
  if (!message) throw new Error('Letter not found.')

  if (isStaffRole(profile.role)) {
    const { data: thread } = await admin
      .from('pen_pal_threads')
      .select('child_id')
      .eq('id', message.thread_id)
      .maybeSingle()
    const { data: child } = await admin
      .from('children')
      .select('country')
      .eq('id', thread?.child_id ?? '')
      .maybeSingle()
    const allowed = profile.country ?? []
    if (!child?.country || !allowed.includes(child.country)) {
      throw new Error('This letter is outside your assigned countries.')
    }
  }
  return message
}

export async function approvePenPalLetter(messageId: string, approvedBody: string) {
  const { user, profile } = await verifyStaffGate()
  const text = approvedBody.trim()
  if (!text) return { error: 'Approved text cannot be empty.' }

  const admin = createAdminClient()
  let threadId: string | null = null
  try {
    const message = await assertMessageInScope(admin, messageId, profile)
    threadId = message.thread_id
    const { error } = await admin
      .from('pen_pal_messages')
      .update({
        status: 'approved',
        approved_body: text,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId)
    if (error) return { error: error.message }

    await logEvent(admin, {
      thread_id: message.thread_id,
      message_id: messageId,
      actor_profile_id: user.id,
      event_type: 'letter_approved',
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Approval failed.' }
  }

  revalidatePath('/dashboard/letters')
  if (threadId) revalidatePath(`/dashboard/letters/${threadId}`)
  return { success: true }
}

export async function rejectPenPalLetter(messageId: string, reason: string) {
  const { user, profile } = await verifyStaffGate()
  const admin = createAdminClient()
  let threadId: string | null = null
  try {
    const message = await assertMessageInScope(admin, messageId, profile)
    threadId = message.thread_id
    const { error } = await admin
      .from('pen_pal_messages')
      .update({
        status: 'rejected',
        rejection_reason: reason.trim() || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId)
    if (error) return { error: error.message }

    await logEvent(admin, {
      thread_id: message.thread_id,
      message_id: messageId,
      actor_profile_id: user.id,
      event_type: 'letter_rejected',
      notes: reason.trim() || null,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Rejection failed.' }
  }

  revalidatePath('/dashboard/letters')
  if (threadId) revalidatePath(`/dashboard/letters/${threadId}`)
  return { success: true }
}

export async function markPenPalDelivered(messageId: string) {
  const { user, profile } = await verifyStaffGate()
  const admin = createAdminClient()
  let threadId: string | null = null
  try {
    const message = await assertMessageInScope(admin, messageId, profile)
    threadId = message.thread_id
    if (message.status !== 'approved') {
      return { error: 'Only approved letters can be marked delivered.' }
    }
    const { error } = await admin
      .from('pen_pal_messages')
      .update({
        status: 'delivered',
        delivered_by: user.id,
        delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId)
    if (error) return { error: error.message }

    await logEvent(admin, {
      thread_id: message.thread_id,
      message_id: messageId,
      actor_profile_id: user.id,
      event_type: 'letter_delivered',
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Delivery update failed.' }
  }

  revalidatePath('/dashboard/letters')
  if (threadId) revalidatePath(`/dashboard/letters/${threadId}`)
  return { success: true }
}

export async function submitChildReply(
  threadId: string,
  body: string,
  options?: { dictatedByChild?: boolean; translatedByStaff?: boolean },
) {
  const { user, profile } = await verifyStaffGate()
  const text = body.trim()
  if (!text) return { error: 'The reply cannot be empty.' }
  if (text.length > MAX_LETTER_CHARS) {
    return { error: `Replies are limited to ${MAX_LETTER_CHARS} characters.` }
  }

  const admin = createAdminClient()

  const { data: thread } = await admin
    .from('pen_pal_threads')
    .select('id, status, child_id')
    .eq('id', threadId)
    .maybeSingle()
  if (!thread) return { error: 'Thread not found.' }
  if (thread.status !== 'active') return { error: 'This letter thread is closed.' }

  // Country scope for staff.
  if (isStaffRole(profile.role)) {
    const { data: child } = await admin
      .from('children')
      .select('country')
      .eq('id', thread.child_id)
      .maybeSingle()
    const allowed = profile.country ?? []
    if (!child?.country || !allowed.includes(child.country)) {
      return { error: 'This thread is outside your assigned countries.' }
    }
  }

  // MVP: staff-entered replies publish directly; statuses retained for a
  // future second-review workflow.
  const now = new Date().toISOString()
  const flags = [
    options?.dictatedByChild ? 'dictated by child' : null,
    options?.translatedByStaff ? 'translated by staff' : null,
  ].filter(Boolean).join('; ')

  const { data: message, error } = await admin
    .from('pen_pal_messages')
    .insert({
      thread_id: threadId,
      direction: 'child_to_donor',
      status: 'published',
      raw_body: text,
      approved_body: text,
      author_profile_id: user.id,
      reviewed_by: user.id,
      reviewed_at: now,
      published_at: now,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  await admin
    .from('pen_pal_threads')
    .update({ last_message_at: now, updated_at: now })
    .eq('id', threadId)

  await logEvent(admin, {
    thread_id: threadId,
    message_id: message.id,
    actor_profile_id: user.id,
    event_type: 'reply_published',
    notes: flags || null,
  })

  revalidatePath('/dashboard/letters')
  revalidatePath(`/dashboard/letters/${threadId}`)
  return { success: true }
}

export async function addPenPalStaffNote(threadId: string, note: string) {
  const { user, profile } = await verifyStaffGate()
  const text = note.trim()
  if (!text) return { error: 'Note cannot be empty.' }

  const admin = createAdminClient()

  if (isStaffRole(profile.role)) {
    const { data: thread } = await admin
      .from('pen_pal_threads')
      .select('child_id')
      .eq('id', threadId)
      .maybeSingle()
    if (!thread) return { error: 'Thread not found.' }
    const { data: child } = await admin
      .from('children')
      .select('country')
      .eq('id', thread.child_id)
      .maybeSingle()
    const allowed = profile.country ?? []
    if (!child?.country || !allowed.includes(child.country)) {
      return { error: 'This thread is outside your assigned countries.' }
    }
  }

  await logEvent(admin, {
    thread_id: threadId,
    actor_profile_id: user.id,
    event_type: 'staff_note',
    notes: text,
  })

  revalidatePath('/dashboard/letters')
  revalidatePath(`/dashboard/letters/${threadId}`)
  return { success: true }
}

/** Admin-only: close a thread (e.g. sponsorship ended or safeguarding concern). */
export async function closePenPalThread(threadId: string, reason: string) {
  const { user, profile } = await verifyStaffGate()
  if (!isAdminRole(profile.role)) return { error: 'Only administrators can close threads.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('pen_pal_threads')
    .update({
      status: 'closed',
      closed_reason: reason.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', threadId)
  if (error) return { error: error.message }

  await logEvent(admin, {
    thread_id: threadId,
    actor_profile_id: user.id,
    event_type: 'thread_closed',
    notes: reason.trim() || null,
  })

  revalidatePath('/dashboard/letters')
  revalidatePath(`/dashboard/letters/${threadId}`)
  return { success: true }
}
