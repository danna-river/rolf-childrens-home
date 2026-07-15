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
        .select('id, id_rolf, first_name, last_name, birth_year, birth_month, birth_day, country, date_joined, career_aspiration, favorite_subject, hobby, bio, notes, status, created_at, updated_at, sync_version')
        .in('country', assignedCountries)
        .order('display_name')

    if ('error' in children && children.error) {
      throw new Error(`Could not read children for bootstrap: ${children.error.message}`)
    }

    const childRows = ('data' in children ? children.data ?? [] : []) as MobileChildRow[]

    return mobileJson({
      server_time: now.toISOString(),
      device_status: 'active',
      staff_email: staff.email,
      staff_countries: assignedCountries,
      countries: (countryRows ?? []).map((country) => ({
        name: country.name,
        iso_code: country.iso_code,
      })),
      id_blocks: [],
      children: childRows.map((child) => toMobileChildSnapshot(child, now)),
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
