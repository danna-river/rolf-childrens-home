import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  authenticateMobileUser,
  mobileErrorResponse,
  mobileJson,
} from '@/app/api/mobile/v1/_lib/auth'

export const runtime = 'nodejs'
export const maxDuration = 60

const bootstrapSchema = z.object({
  device_installation_id: z.string().trim().min(3).max(200),
  device_label: z.string().trim().min(1).max(200),
  app_version: z.string().trim().min(1).max(80),
})

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

type MobileChildRow = {
  id: string
  id_rolf: string | null
  first_name: string | null
  last_name: string | null
  birth_year: number | null
  birth_month: number | null
  birth_day: number | null
  country: string | null
  date_joined: string | null
  career_aspiration: string | null
  favorite_subject: string | null
  hobby: string | null
  bio: string | null
  notes: string | null
  status: string | null
  profile_complete: boolean | null
  created_at: string | null
  updated_at: string | null
  sync_version: number | null
}

function toEpochMillis(value: string | null | undefined, fallback: Date): number {
  const parsed = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : fallback.getTime()
}

function toMobileChildSnapshot(child: MobileChildRow, fallbackTime: Date) {
  return {
    id: child.id,
    id_rolf: child.id_rolf,
    fields: {
      firstName: child.first_name ?? '',
      lastName: child.last_name ?? '',
      birthYear: child.birth_year,
      birthMonth: child.birth_month,
      birthDay: child.birth_day,
      country: child.country ?? '',
      dateJoined: child.date_joined,
      careerAspiration: child.career_aspiration ?? '',
      favoriteSubject: child.favorite_subject ?? '',
      hobby: child.hobby ?? '',
      bio: child.bio ?? '',
      notes: child.notes ?? '',
      status: child.status ?? 'active',
    },
    sync_version: child.sync_version ?? 0,
    profile_complete: child.profile_complete ?? false,
    updated_at: toEpochMillis(child.updated_at ?? child.created_at, fallbackTime),
  }
}

/**
 * Registers/renews one Android handset and returns the staff member's complete
 * country-scoped offline snapshot. This is the only route that may enroll a
 * device; every mutation route requires that active device afterward.
 */
export async function POST(request: NextRequest) {
  try {
    const input = bootstrapSchema.parse(await request.json())
    const staff = await authenticateMobileUser(request)
    const admin = createAdminClient()
    const now = new Date()
    const offlineAccessExpiresAt = new Date(now.getTime() + NINETY_DAYS_MS).toISOString()

    // A fresh bootstrap intentionally retires the previous handset, if any.
    const { error: revokeError } = await admin
      .from('mobile_devices')
      .update({ revoked_at: now.toISOString(), updated_at: now.toISOString() })
      .eq('user_id', staff.userId)
      .neq('installation_id', input.device_installation_id)
      .is('revoked_at', null)

    if (revokeError) throw new Error(`Could not retire the prior mobile device: ${revokeError.message}`)

    const { data: device, error: deviceError } = await admin
      .from('mobile_devices')
      .upsert({
        user_id: staff.userId,
        installation_id: input.device_installation_id,
        device_label: input.device_label,
        app_version: input.app_version,
        last_seen_at: now.toISOString(),
        offline_access_expires_at: offlineAccessExpiresAt,
        revoked_at: null,
        updated_at: now.toISOString(),
      }, { onConflict: 'user_id,installation_id' })
      .select('*')
      .single()

    if (deviceError || !device) {
      throw new Error(`Could not register the mobile device: ${deviceError?.message ?? 'No device returned.'}`)
    }

    const { data: countryRows, error: countryError } = await admin
      .from('countries')
      .select('name, iso_code')
      .order('name')
    if (countryError) throw new Error(`Could not read countries: ${countryError.message}`)

    const assignedCountries = staff.isAdmin
      ? (countryRows ?? []).map((country) => country.name)
      : staff.assignedCountries

    const children = assignedCountries.length === 0
      ? []
      : await admin
        .from('children')
        .select('id, id_rolf, first_name, last_name, birth_year, birth_month, birth_day, country, date_joined, career_aspiration, favorite_subject, hobby, bio, notes, status, profile_complete, created_at, updated_at, sync_version')
        .in('country', assignedCountries)
        .order('display_name')

    if ('error' in children && children.error) {
      throw new Error(`Could not read children for bootstrap: ${children.error.message}`)
    }

    const childRows = ('data' in children ? children.data ?? [] : []) as MobileChildRow[]
    const childIds = childRows.map((child) => child.id)

    // Intake catalog: every template (including inactive) with its questions.
    // The phone evaluates eligibility offline, mirroring getEligibleIntakeForms.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intake tables are not in the generated Database schema yet.
    const { data: templateRows, error: templateError } = await (admin as any)
      .from('intake_templates')
      .select(`
        id,
        title,
        country,
        status,
        created_at,
        template_questions (
          id,
          question_text,
          field_type,
          choices,
          sort_order
        )
      `)
      .order('created_at', { ascending: false })
    if (templateError) throw new Error(`Could not read intake templates: ${templateError.message}`)

    // Saved intake answers and the media library index, scoped to the snapshot.
    let reportRows: {
      id: string
      child_id: string
      template_id: string
      report_answers: { question_id: string; answer_value: string | null }[] | null
    }[] = []
    let mediaRows: {
      id: string
      child_id: string
      media_type: string | null
      usage_type: string | null
      filename: string | null
      created_at: string | null
    }[] = []

    if (childIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- progress_reports is not in the generated Database schema yet.
      const { data: reports, error: reportError } = await (admin as any)
        .from('progress_reports')
        .select('id, child_id, template_id, report_answers (question_id, answer_value)')
        .in('child_id', childIds)
      if (reportError) throw new Error(`Could not read progress reports: ${reportError.message}`)
      reportRows = reports ?? []

      const { data: media, error: mediaError } = await admin
        .from('child_media')
        .select('id, child_id, media_type, usage_type, filename, created_at')
        .in('child_id', childIds)
        .order('created_at', { ascending: false })
      if (mediaError) throw new Error(`Could not read child media for bootstrap: ${mediaError.message}`)
      mediaRows = media ?? []
    }

    return mobileJson({
      server_time: now.toISOString(),
      device_status: 'active',
      staff_email: staff.email,
      staff_role: staff.isAdmin ? 'admin' : 'staff',
      staff_countries: assignedCountries,
      countries: (countryRows ?? []).map((country) => ({
        name: country.name,
        iso_code: country.iso_code,
      })),
      id_blocks: [],
      children: childRows.map((child) => toMobileChildSnapshot(child, now)),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped intake rows, see selects above.
      intake_templates: (templateRows ?? []).map((template: any) => ({
        id: template.id,
        title: template.title ?? '',
        country: template.country ?? 'all',
        status: template.status ?? 'active',
        created_at: toEpochMillis(template.created_at, now),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        questions: (template.template_questions ?? []).map((question: any) => ({
          id: question.id,
          question_text: question.question_text ?? '',
          field_type: question.field_type ?? 'text',
          choices: question.choices ?? null,
          sort_order: question.sort_order ?? 0,
        })),
      })),
      progress_reports: reportRows.map((report) => ({
        id: report.id,
        child_id: report.child_id,
        template_id: report.template_id,
        answers: (report.report_answers ?? []).map((answer) => ({
          question_id: answer.question_id,
          answer_value: answer.answer_value ?? '',
        })),
      })),
      media: mediaRows.map((media) => ({
        id: media.id,
        child_id: media.child_id,
        media_type: media.media_type ?? 'photo',
        usage_type: media.usage_type ?? 'library',
        filename: media.filename ?? '',
        created_at: toEpochMillis(media.created_at, now),
      })),
      staff: {
        id: staff.userId,
        email: staff.email,
        assigned_countries: assignedCountries,
      },
      device: {
        id: device.id,
        installation_id: device.installation_id,
        label: device.device_label,
        app_version: device.app_version,
        status: 'active',
        offline_access_expires_at: device.offline_access_expires_at,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileJson({ error: { code: 'invalid_bootstrap_request', message: 'The bootstrap request is invalid.' } }, { status: 400 })
    }
    return mobileErrorResponse(error)
  }
}
