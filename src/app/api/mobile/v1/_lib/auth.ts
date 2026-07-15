import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminRole, isStaffRole, type UserProfile } from '@/lib/profiles'
import type { Database, MobileDevice } from '@/lib/types'

const DEVICE_ID_HEADER = 'x-rolf-device-installation-id'
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

export class MobileApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export type MobileAuthContext = {
  userId: string
  email: string
  profile: UserProfile
  assignedCountries: string[]
  isAdmin: boolean
  device: MobileDevice
}

function getAuthorizationToken(request: NextRequest): string {
  const value = request.headers.get('authorization')
  const match = /^Bearer\s+(.+)$/i.exec(value ?? '')
  if (!match) {
    throw new MobileApiError(401, 'missing_bearer_token', 'A Supabase access token is required.')
  }

  return match[1].trim()
}

function getPublicSupabaseKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!key || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Supabase public authentication environment variables are missing.')
  }

  return key
}

/** Verifies a user JWT against Supabase Auth, then reads server-authoritative role/scope. */
export async function authenticateMobileUser(request: NextRequest): Promise<{
  userId: string
  email: string
  profile: UserProfile
  assignedCountries: string[]
  isAdmin: boolean
}> {
  const token = getAuthorizationToken(request)
  const authClient = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getPublicSupabaseKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  )

  const { data: authData, error: authError } = await authClient.auth.getUser(token)
  if (authError || !authData.user) {
    throw new MobileApiError(401, 'invalid_bearer_token', 'The access token is invalid or expired.')
  }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, role, country, full_name')
    .eq('id', authData.user.id)
    .maybeSingle() as { data: UserProfile | null; error: { message: string } | null }

  if (profileError || !profile || (!isAdminRole(profile.role) && !isStaffRole(profile.role))) {
    throw new MobileApiError(403, 'staff_access_required', 'This account is not approved for mobile staff access.')
  }

  return {
    userId: authData.user.id,
    email: authData.user.email ?? '',
    profile,
    assignedCountries: profile.country ?? [],
    isAdmin: isAdminRole(profile.role),
  }
}

export function readDeviceInstallationId(request: NextRequest): string {
  const installationId = request.headers.get(DEVICE_ID_HEADER)?.trim()
  if (!installationId || installationId.length < 3 || installationId.length > 200) {
    throw new MobileApiError(
      400,
      'missing_device_installation_id',
      `Provide a valid ${DEVICE_ID_HEADER} header.`,
    )
  }

  return installationId
}

/** Requires an active, non-expired device owned by the authenticated staff user. */
export async function authenticateMobileDevice(
  request: NextRequest,
  installationId = readDeviceInstallationId(request),
): Promise<MobileAuthContext> {
  const user = await authenticateMobileUser(request)
  const admin = createAdminClient()
  const { data: device, error } = await admin
    .from('mobile_devices')
    .select('*')
    .eq('user_id', user.userId)
    .eq('installation_id', installationId)
    .is('revoked_at', null)
    .maybeSingle()

  if (error || !device) {
    throw new MobileApiError(403, 'device_not_registered', 'This device is not registered for mobile access.')
  }

  if (Date.parse(device.offline_access_expires_at) <= Date.now()) {
    throw new MobileApiError(403, 'device_lease_expired', 'This device must complete bootstrap before syncing again.')
  }

  const now = new Date()
  const offlineAccessExpiresAt = new Date(now.getTime() + NINETY_DAYS_MS).toISOString()
  const { error: touchError } = await admin
    .from('mobile_devices')
    .update({
      last_seen_at: now.toISOString(),
      offline_access_expires_at: offlineAccessExpiresAt,
      updated_at: now.toISOString(),
    })
    .eq('id', device.id)

  if (touchError) {
    throw new Error(`Could not renew the mobile device lease: ${touchError.message}`)
  }

  return {
    ...user,
    device: {
      ...device,
      last_seen_at: now.toISOString(),
      offline_access_expires_at: offlineAccessExpiresAt,
      updated_at: now.toISOString(),
    },
  }
}

export function assertCountryScope(context: Pick<MobileAuthContext, 'assignedCountries' | 'isAdmin'>, country: string | null | undefined): asserts country is string {
  if (!country || (!context.isAdmin && !context.assignedCountries.includes(country))) {
    throw new MobileApiError(403, 'country_out_of_scope', 'The child is outside this staff account\'s assigned countries.')
  }
}

export function mobileErrorResponse(error: unknown): NextResponse {
  if (error instanceof MobileApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      {
        status: error.status,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }

  console.error('[mobile-api] unexpected error', error)
  return NextResponse.json(
    { error: { code: 'internal_error', message: 'The mobile request could not be completed.' } },
    { status: 500, headers: { 'Cache-Control': 'no-store' } },
  )
}

export function mobileJson(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, {
    ...init,
    headers: {
      'Cache-Control': 'no-store',
      ...init?.headers,
    },
  })
}
