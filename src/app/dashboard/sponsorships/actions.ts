"use server"

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { isAdminRole } from '@/lib/profiles'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSponsorInvitationEmail } from '@/lib/email'

const frequencyEnum = z.enum([
  'one_time',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
])

const paymentMethodEnum = z.enum([
  '',
  'square',
  'pushpay',
  'check',
  'stock',
  'fidelity',
  'charity_account',
  'other',
])

const contactSchema = z.object({
  fullName: z.string().trim().min(1, 'Contact name is required.').max(160),
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.'),
  phone: z.string().trim().max(60),
  receiptPreference: z.enum(['unknown', 'requested', 'not_needed']),
  notes: z.string().trim().max(2000),
})

// A request is either earmarked for a child (sponsorship) or a general
// donation with no child attached. Both carry the same money fields.
const requestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('sponsorship'),
    childId: z.string().uuid('Select a valid child for the sponsorship.'),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    amount: z.string().trim().min(1, 'Donation amount is required.'),
    frequency: frequencyEnum,
    paymentMethod: paymentMethodEnum,
    notes: z.string().trim().max(2000),
  }),
  z.object({
    type: z.literal('donation'),
    startDate: z.iso.date(),
    endDate: z.iso.date().nullable(),
    amount: z.string().trim().min(1, 'Donation amount is required.'),
    frequency: frequencyEnum,
    paymentMethod: paymentMethodEnum,
    notes: z.string().trim().max(2000),
  }),
])

const submissionSchema = z.object({
  contact: contactSchema,
  requests: z.array(requestSchema).min(1, 'Add at least one donation or sponsorship.'),
})

export type CreateContactRequest = z.input<typeof requestSchema>
export type CreateContactWithRequestsInput = z.input<typeof submissionSchema>

async function verifyAdminGate() {
  const { user, profile } = await requireAuth()
  if (!isAdminRole(profile.role)) {
    throw new Error('Unauthorized: Administrative clearance required.')
  }
  return user
}

async function expirePastSponsorships() {
  const adminSupabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { error } = await adminSupabase
    .from('sponsorships')
    .update({ status: 'ended' })
    .eq('status', 'active')
    .lt('end_date', today)

  return error
}

function cleanOptional(value: string) {
  return value === '' ? null : value
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function escapeIlikePattern(value: string) {
  return value.replace(/([\\%_])/g, '\\$1')
}

function parseAmount(raw: string) {
  const amount = Number(raw)
  if (!Number.isFinite(amount) || amount <= 0) return null
  return amount
}

export async function createContactWithRequestsAction(input: CreateContactWithRequestsInput) {
  const user = await verifyAdminGate()

  const parsed = submissionSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid submission.' }
  }

  const { contact, requests } = parsed.data
  const adminSupabase = createAdminClient()

  // Validate each request's money/date fields up front so nothing is written
  // when one entry is invalid.
  for (const request of requests) {
    if (parseAmount(request.amount) === null) {
      return { error: 'Donation amount must be greater than zero.' }
    }
    if (request.type === 'sponsorship' && request.endDate < request.startDate) {
      return { error: 'End date must be on or after the start date.' }
    }
  }

  const sponsorshipRequests = requests.filter((request) => request.type === 'sponsorship')
  const childIds = sponsorshipRequests.map((request) => request.childId)
  if (new Set(childIds).size !== childIds.length) {
    return { error: 'The same child cannot be sponsored twice in one submission.' }
  }

  // A contact that sponsors a child is a "sponsor"; otherwise donation-only.
  // Existing sponsors are never downgraded by a later standalone donation.
  const requestedContactType = sponsorshipRequests.length > 0 ? 'sponsor' : 'donor_only'
  const normalizedEmail = normalizeEmail(contact.email)

  // Confirm every child is available before creating anything.
  if (childIds.length > 0) {
    const [{ data: children, error: childrenError }, { data: activeMatches, error: matchError }] =
      await Promise.all([
        adminSupabase.from('children').select('id, status').in('id', childIds),
        adminSupabase
          .from('sponsorships')
          .select('child_id')
          .eq('status', 'active')
          .in('child_id', childIds),
      ])

    if (childrenError) return { error: childrenError.message }
    if (matchError) return { error: matchError.message }

    const availableIds = new Set(
      (children ?? []).filter((child) => child.status === 'active').map((child) => child.id),
    )
    if (childIds.some((id) => !availableIds.has(id))) {
      return { error: 'One of the selected children is no longer available for sponsorship.' }
    }
    if ((activeMatches ?? []).length > 0) {
      return { error: 'One of the selected children already has an active sponsorship.' }
    }
  }

  // Find or create the contact by email first so repeat event entries roll up
  // under one sponsor record even when the name formatting changes.
  let sponsorId: string | null = null
  const { data: existingSponsor, error: lookupError } = await adminSupabase
    .from('sponsors')
    .select('id, contact_type')
    .ilike('email', escapeIlikePattern(normalizedEmail))
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (lookupError) return { error: lookupError.message }

  if (existingSponsor) {
    sponsorId = existingSponsor.id
    const contactType = existingSponsor.contact_type === 'sponsor' || requestedContactType === 'sponsor'
      ? 'sponsor'
      : requestedContactType

    const { error: updateError } = await adminSupabase
      .from('sponsors')
      .update({
        full_name: contact.fullName,
        email: normalizedEmail,
        phone: cleanOptional(contact.phone),
        contact_type: contactType,
        receipt_preference: contact.receiptPreference,
        notes: cleanOptional(contact.notes),
      })
      .eq('id', sponsorId)

    if (updateError) return { error: updateError.message }
  }

  let isNewSponsor = false
  if (!sponsorId) {
    const { data: sponsor, error: insertError } = await adminSupabase
      .from('sponsors')
      .insert({
        full_name: contact.fullName,
        email: normalizedEmail,
        phone: cleanOptional(contact.phone),
        contact_type: requestedContactType,
        receipt_preference: contact.receiptPreference,
        notes: cleanOptional(contact.notes),
        profile_id: null,
      })
      .select('id')
      .single()

    if (insertError) return { error: insertError.message }
    sponsorId = sponsor.id
    isNewSponsor = true
  }

  const expiryError = await expirePastSponsorships()
  if (expiryError) return { error: expiryError.message }

  const rows = requests.map((request) => ({
    sponsor_id: sponsorId,
    child_id: request.type === 'sponsorship' ? request.childId : null,
    status: 'active' as const,
    start_date: request.startDate,
    end_date: request.endDate,
    amount: parseAmount(request.amount),
    frequency: request.frequency,
    payment_method: cleanOptional(request.paymentMethod),
    notes: cleanOptional(request.notes),
    assigned_by: user.id,
  }))

  const { error } = await adminSupabase.from('sponsorships').insert(rows)

  if (error?.code === '23505') {
    return { error: 'One of the selected children was just matched by another administrator.' }
  }
  if (error) return { error: error.message }

  if (isNewSponsor) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    try {
      await sendSponsorInvitationEmail(normalizedEmail, contact.fullName, appUrl)
    } catch (err) {
      console.error('[createContact] sponsor invite email error:', err)
    }
  }

  revalidatePath('/dashboard/sponsorships')
  revalidatePath('/dashboard/children')
  return { success: true, created: rows.length }
}

export async function endSponsorshipAction(sponsorshipId: string) {
  await verifyAdminGate()

  const parsedId = z.string().uuid().safeParse(sponsorshipId)
  if (!parsedId.success) return { error: 'Invalid sponsorship ID.' }

  const adminSupabase = createAdminClient()
  const { data: sponsorship } = await adminSupabase
    .from('sponsorships')
    .select('start_date')
    .eq('id', parsedId.data)
    .eq('status', 'active')
    .maybeSingle()

  if (!sponsorship) return { error: 'Active sponsorship not found.' }

  const today = new Date().toISOString().slice(0, 10)
  const endDate = sponsorship.start_date > today ? sponsorship.start_date : today
  const { error } = await adminSupabase
    .from('sponsorships')
    .update({ status: 'ended', end_date: endDate })
    .eq('id', parsedId.data)
    .eq('status', 'active')

  if (error) return { error: error.message }

  revalidatePath('/dashboard/sponsorships')
  revalidatePath('/dashboard/children')
  return { success: true }
}
