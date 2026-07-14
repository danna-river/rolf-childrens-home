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
const RESERVED_IDS_PER_COUNTRY = 50

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
      .select('name')
      .order('name')
    if (countryError) throw new Error(`Could not read countries: ${countryError.message}`)

    const assignedCountries = staff.isAdmin
      ? (countryRows ?? []).map((country) => country.name)
      : staff.assignedCountries

    const { data: existingReservations, error: reservationError } = await admin
      .from('rolf_id_reservations')
      .select('id_rolf, country, expires_at')
      .eq('device_id', device.id)
      .is('claimed_at', null)
      .gt('expires_at', now.toISOString())
      .in('country', assignedCountries)

    if (reservationError) throw new Error(`Could not read ROLF ID reservations: ${reservationError.message}`)

    const reservations = [...(existingReservations ?? [])]
    for (const country of assignedCountries) {
      const count = reservations.filter((reservation) => reservation.country === country).length
      if (count >= RESERVED_IDS_PER_COUNTRY) continue

      const { data: allocated, error: allocationError } = await admin.rpc('reserve_mobile_rolf_ids', {
        p_device_id: device.id,
        p_user_id: staff.userId,
        p_country: country,
        p_count: RESERVED_IDS_PER_COUNTRY - count,
      })
      if (allocationError) throw new Error(`Could not reserve ROLF IDs for ${country}: ${allocationError.message}`)

      reservations.push(...(allocated ?? []).map((reservation) => ({
        ...reservation,
        country,
      })))
    }

    const children = assignedCountries.length === 0
      ? []
      : await admin
        .from('children')
        .select('id, id_rolf, display_name, first_name, last_name, birth_year, birth_month, birth_day, country, year_joined, date_joined, career_aspiration, favorite_subject, hobby, bio, notes, status, profile_photo, profile_video, created_at, updated_at, sync_version')
        .in('country', assignedCountries)
        .order('display_name')

    if ('error' in children && children.error) {
      throw new Error(`Could not read children for bootstrap: ${children.error.message}`)
    }

    const childRows = 'data' in children ? children.data ?? [] : []
    const childIds = childRows.map((child) => child.id)
    const media = childIds.length === 0
      ? []
      : await admin
        .from('child_media')
        .select('id, child_id, gdrive_file_id, filename, url, media_type, usage_type, source, created_at')
        .in('child_id', childIds)
        .order('created_at')

    if ('error' in media && media.error) {
      throw new Error(`Could not read media metadata for bootstrap: ${media.error.message}`)
    }

    return mobileJson({
      server_time: now.toISOString(),
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
      children: childRows,
      media: 'data' in media ? media.data ?? [] : [],
      rolf_id_reservations: reservations,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileJson({ error: { code: 'invalid_bootstrap_request', message: 'The bootstrap request is invalid.' } }, { status: 400 })
    }
    return mobileErrorResponse(error)
  }
}
