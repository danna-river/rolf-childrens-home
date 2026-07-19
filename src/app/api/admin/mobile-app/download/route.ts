import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { mobileAppRelease, MOBILE_APP_SIGNED_URL_SECONDS } from '@/lib/mobile-app-release'
import { isAdminRole, isStaffRole, type UserProfile } from '@/lib/profiles'

export const dynamic = 'force-dynamic'

async function getAuthorizedProfile(): Promise<
  | { authorized: true; profile: UserProfile }
  | { authorized: false; status: 401 | 403; error: string }
> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { authorized: false, status: 401, error: 'Unauthorized' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, country, full_name')
    .eq('id', user.id)
    .single() as { data: UserProfile | null; error: unknown }

  if (profileError || !profile) {
    return { authorized: false, status: 401, error: 'Unauthorized' }
  }

  if (!isAdminRole(profile.role) && !isStaffRole(profile.role)) {
    return { authorized: false, status: 403, error: 'Forbidden' }
  }

  return { authorized: true, profile }
}

export async function GET() {
  const auth = await getAuthorizedProfile()
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Android app download is not configured.' },
      { status: 500 },
    )
  }

  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(mobileAppRelease.bucket)
    .createSignedUrl(
      mobileAppRelease.storagePath,
      MOBILE_APP_SIGNED_URL_SECONDS,
      { download: mobileAppRelease.filename },
    )

  if (error || !data?.signedUrl) {
    console.error('[mobile-app-download] signed URL failed:', error?.message ?? 'No signed URL returned')
    return NextResponse.json(
      { error: 'The Android app download is not available.' },
      { status: 404 },
    )
  }

  const response = NextResponse.redirect(data.signedUrl, { status: 302 })
  response.headers.set('Cache-Control', 'no-store')
  return response
}
