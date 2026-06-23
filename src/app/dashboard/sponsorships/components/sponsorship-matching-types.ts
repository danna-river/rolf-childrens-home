// Shared types and constants for the sponsor-matching screen. Kept in one place
// so the page, the view, and each section agree on the same shapes.
import type {
  ReceiptPreference,
  Sponsor,
  SponsorshipFrequency,
  SponsorshipPaymentMethod,
} from '@/lib/types'

// Where a child's "unmatched since" date came from, so the list can word it correctly.
export type UnmatchedSinceSource = 'last_sponsorship_end' | 'joined_home' | 'unknown'

export type SponsorshipPoolChild = {
  id: string
  id_rolf: string | null
  display_name: string
  first_name: string | null
  last_name: string | null
  country: string | null
  year_joined: number | null
  date_joined: string | null
  unmatched_since: string | null
  unmatched_since_source: UnmatchedSinceSource
  birth_year: number | null
  birth_month: number | null
  birth_day: number | null
  age: number
}

export type ChildAgeFilter = 'all' | '0_5' | '6_10' | '11_14' | '15_plus' | 'unknown'
export type ChildSort = 'longest_wait' | 'youngest' | 'oldest' | 'longest_in_home'

export type CurrentSponsorship = {
  id: string
  sponsor_id: string | null
  child_id: string | null
  status: 'active' | 'ended'
  start_date: string
  end_date: string | null
  amount: number | null
  frequency: SponsorshipFrequency | null
  payment_method: SponsorshipPaymentMethod | null
  notes: string | null
  sponsor: Pick<Sponsor, 'id' | 'full_name' | 'email'> | null
  child: Pick<SponsorshipPoolChild, 'id' | 'id_rolf' | 'display_name' | 'country'> | null
}

export type SponsorshipMatchingViewProps = {
  sponsors: Sponsor[]
  currentSponsorships: CurrentSponsorship[]
  pool: SponsorshipPoolChild[]
}

// One row of the matching form. A contact can be saved with several of these at
// once — a mix of child sponsorships and plain donations.
export type RequestDraft = {
  key: string
  type: 'sponsorship' | 'donation'
  childIds: string[]
  childSearch: string
  countryFilter: string
  ageFilter: ChildAgeFilter
  childSort: ChildSort
  amount: string
  frequency: SponsorshipFrequency
  paymentMethod: SponsorshipPaymentMethod | ''
  duration: string
  durationUnit: 'months' | 'years'
  notes: string
}

export type ContactDraft = {
  email: string
  fullName: string
  phone: string
  receiptPreference: ReceiptPreference
  notes: string
}

// Page sizes offered in both the contacts and active-records lists.
export const pageSizeOptions = [5, 10, 20] as const

export type PageSize = (typeof pageSizeOptions)[number]
