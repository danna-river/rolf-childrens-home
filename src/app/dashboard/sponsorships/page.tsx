import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { isAdminRole } from '@/lib/profiles'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Sponsor } from '@/lib/types'
import {
  SponsorshipMatchingView,
  type CurrentSponsorship,
  type SponsorshipPoolChild,
} from '@/app/dashboard/sponsorships/sponsorship-matching-view'

export default async function SponsorshipsPage() {
  const { profile } = await requireAuth()
  if (!isAdminRole(profile.role)) redirect('/dashboard')

  const adminSupabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  // Expired matches remain history, but no longer reserve a child.
  await adminSupabase
    .from('sponsorships')
    .update({ status: 'ended' })
    .eq('status', 'active')
    .lt('end_date', today)

  const [sponsorsResult, sponsorshipsResult, childrenResult] = await Promise.all([
    adminSupabase
      .from('sponsors')
      .select('id, full_name, email, phone, contact_type, receipt_preference, notes, profile_id, created_at')
      .order('full_name'),
    adminSupabase
      .from('sponsorships')
      .select(`
        id,
        sponsor_id,
        child_id,
        start_date,
        end_date,
        amount,
        frequency,
        payment_method,
        notes,
        sponsor:sponsors(id, full_name, email),
        child:children(id, id_rolf, display_name, country)
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    adminSupabase
      .from('children')
      .select('id, id_rolf, display_name, first_name, last_name, country, year_joined, date_joined')
      .eq('status', 'active'),
  ])

  const sponsors = (sponsorsResult.data ?? []) as Sponsor[]
  const currentSponsorships = (sponsorshipsResult.data ?? []) as unknown as CurrentSponsorship[]
  const sponsoredChildIds = new Set(currentSponsorships.map((sponsorship) => sponsorship.child_id))
  const pool = ((childrenResult.data ?? []) as SponsorshipPoolChild[])
    .filter((child) => !sponsoredChildIds.has(child.id))
    .sort((left, right) => {
      const leftJoined = left.date_joined ?? (left.year_joined ? `${left.year_joined}-01-01` : '9999-12-31')
      const rightJoined = right.date_joined ?? (right.year_joined ? `${right.year_joined}-01-01` : '9999-12-31')
      return leftJoined.localeCompare(rightJoined)
    })

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="pb-2">
        <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-blue-600">
          Admin Dashboard
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Sponsorships
        </h1>
        <p className="mt-0.5 text-xs text-gray-500">
          Manage event contacts, match sponsors with children, and track sponsorship terms.
        </p>
      </div>

      <SponsorshipMatchingView
        sponsors={sponsors}
        currentSponsorships={currentSponsorships}
        pool={pool}
      />
    </main>
  )
}
