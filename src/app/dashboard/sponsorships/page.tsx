// Admin-only server page for sponsor matching. Loads sponsors, active records, and
// the unmatched-child pool, then hands them to the client view. Admin-only, so it
// uses the service-role client to read across all records.
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { isAdminRole } from '@/lib/profiles'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Sponsor } from '@/lib/types'
import {
  SponsorshipMatchingView,
} from '@/app/dashboard/sponsorships/components/sponsorship-matching-view'
import type {
  CurrentSponsorship,
  SponsorshipPoolChild,
  UnmatchedSinceSource,
} from '@/app/dashboard/sponsorships/components/sponsorship-matching-types'
import { calculateAge } from '@/components/actions'

type SponsorshipHistoryRow = {
  child_id: string | null
  start_date: string
  end_date: string | null
}

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

  const [sponsorsResult, sponsorshipsResult, childrenResult, historyResult] = await Promise.all([
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
        status,
        start_date,
        end_date,
        amount,
        frequency,
        payment_method,
        notes,
        sponsor:sponsors(id, full_name, email),
        child:children(id, id_rolf, display_name, country)
      `)
      .order('created_at', { ascending: false }),
    adminSupabase
      .from('children')
      .select('id, id_rolf, display_name, first_name, last_name, birth_year, birth_month, birth_day, country, year_joined, date_joined')
      .eq('status', 'active'),
    adminSupabase
      .from('sponsorships')
      .select('child_id, start_date, end_date')
      .eq('status', 'ended')
      .not('child_id', 'is', null),
  ])

  const sponsors = (sponsorsResult.data ?? []) as Sponsor[]
  const currentSponsorships = (sponsorshipsResult.data ?? []) as unknown as CurrentSponsorship[]
  const sponsorshipHistory = (historyResult.data ?? []) as SponsorshipHistoryRow[]
  const sponsoredChildIds = new Set(currentSponsorships.map((sponsorship) => sponsorship.child_id))
  const lastEndedSponsorshipByChildId = new Map<string, string>()

  // For each child, find the most recent date a past sponsorship ended. That's the
  // start of their current wait when they've been matched before.
  for (const sponsorship of sponsorshipHistory) {
    if (!sponsorship.child_id) continue
    const unmatchedSince = sponsorship.end_date ?? sponsorship.start_date
    const current = lastEndedSponsorshipByChildId.get(sponsorship.child_id)
    if (!current || unmatchedSince > current) {
      lastEndedSponsorshipByChildId.set(sponsorship.child_id, unmatchedSince)
    }
  }

  // The matching pool is every active child not currently sponsored. Each one gets
  // an "unmatched since" date: their last sponsorship end if they've had one,
  // otherwise when they joined the home. Sorted longest-waiting first.
  const pool = ((childrenResult.data ?? []) as SponsorshipPoolChild[])
    .filter((child) => !sponsoredChildIds.has(child.id))
    .map((child) => {
      const lastEndedSponsorship = lastEndedSponsorshipByChildId.get(child.id)
      const joinedHome = child.date_joined ?? (child.year_joined ? `${child.year_joined}-01-01` : null)
      const source: UnmatchedSinceSource = lastEndedSponsorship
        ? 'last_sponsorship_end'
        : joinedHome
          ? 'joined_home'
          : 'unknown'

      return {
        ...child,
        unmatched_since: lastEndedSponsorship ?? joinedHome,
        unmatched_since_source: source,
        age: calculateAge(child.birth_year, child.birth_month, child.birth_day),
      }
    })
    .sort((left, right) => {
      const leftUnmatched = left.unmatched_since ?? '9999-12-31'
      const rightUnmatched = right.unmatched_since ?? '9999-12-31'
      return leftUnmatched.localeCompare(rightUnmatched)
    })

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="max-w-3xl pb-1">
        <div className="mb-2 inline-flex items-center rounded-md bg-sky/65 px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-navy">
          Admin dashboard
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          Sponsor matching
        </h1>
        <p className="mt-3 text-base leading-7 text-navy/65">
          Record event contacts, assign child sponsorships, and keep standalone donations in one active record list.
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
