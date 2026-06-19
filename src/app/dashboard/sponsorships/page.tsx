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
