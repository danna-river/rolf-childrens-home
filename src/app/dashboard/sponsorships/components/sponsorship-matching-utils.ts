// Pure helpers for the matching screen: shared input styling, label lookups,
// money/date formatting, and the child pool filter/sort logic. No React here so
// the server page and the client sections can both pull from it.
import type {
  ReceiptPreference,
  Sponsor,
  SponsorshipFrequency,
  SponsorshipPaymentMethod,
} from '@/lib/types'
import type {
  ChildAgeFilter,
  ChildSort,
  ContactDraft,
  RequestDraft,
  SponsorshipPoolChild,
} from '@/app/dashboard/sponsorships/components/sponsorship-matching-types'

export const fieldClass =
  'w-full rounded-xl border border-stone bg-white px-3.5 py-2.5 text-base leading-6 text-navy outline-none motion-safe:transition-colors focus:border-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:bg-ice disabled:text-navy/50'

export const labelClass = 'block text-base font-semibold text-navy/70'

export const today = () => new Date().toISOString().slice(0, 10)
export const noCountryFilter = '__no_country__'
export const noFrequencyFilter = '__no_frequency__'
export const noPaymentFilter = '__no_payment__'

export const emptyContactDraft: ContactDraft = {
  email: '',
  fullName: '',
  phone: '',
  receiptPreference: 'unknown',
  notes: '',
}

const moneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

const wholeMoneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function makeDraft(type: RequestDraft['type'], key: string): RequestDraft {
  return {
    key,
    type,
    childIds: [],
    childSearch: '',
    countryFilter: 'all',
    ageFilter: 'all',
    childSort: 'longest_wait',
    amount: '',
    frequency: 'monthly',
    paymentMethod: '',
    duration: '1',
    durationUnit: 'years',
    notes: '',
  }
}

// Add a whole number of months or years to today's date. Done in UTC and clamped
// to the last day of the target month so e.g. Jan 31 + 1 month lands on Feb 28/29
// rather than rolling into March.
export function sponsorshipEndDate(duration: number, unit: 'months' | 'years') {
  const [year, month, day] = today().split('-').map(Number)
  const targetMonth = unit === 'months' ? month - 1 + duration : month - 1
  const targetYear = unit === 'years' ? year + duration : year + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay))).toISOString().slice(0, 10)
}

export function formatDate(value: string | null) {
  if (!value) return 'Open ended'
  return new Date(`${value}T12:00:00`).toLocaleDateString()
}

export function joinedLabel(child: SponsorshipPoolChild) {
  if (child.date_joined) return formatDate(child.date_joined)
  if (child.year_joined) return String(child.year_joined)
  return 'Unknown'
}

// Human-readable wait status. Wording depends on whether the date came from a
// prior sponsorship ending or just from when the child joined the home.
export function unmatchedSinceLabel(child: SponsorshipPoolChild) {
  if (child.unmatched_since_source === 'joined_home') {
    return child.unmatched_since
      ? `Never matched; waiting since ${formatDate(child.unmatched_since)}`
      : 'Never matched'
  }
  if (child.unmatched_since_source === 'unknown') return 'Never matched'
  if (!child.unmatched_since) return 'Previously matched'
  return `Unmatched since ${formatDate(child.unmatched_since)}`
}

export function childAgeLabel(child: SponsorshipPoolChild) {
  return child.age === null ? 'Age unknown' : `Age ${child.age}`
}

function joinedSortValue(child: SponsorshipPoolChild) {
  return child.date_joined ?? (child.year_joined ? `${child.year_joined}-01-01` : '9999-12-31')
}

function unmatchedSortValue(child: SponsorshipPoolChild) {
  return child.unmatched_since ?? joinedSortValue(child)
}

function matchesAgeFilter(child: SponsorshipPoolChild, filter: ChildAgeFilter) {
  if (filter === 'all') return true
  if (filter === 'unknown') return child.age === null
  if (child.age === null) return false

  if (filter === '0_5') return child.age >= 0 && child.age <= 5
  if (filter === '6_10') return child.age >= 6 && child.age <= 10
  if (filter === '11_14') return child.age >= 11 && child.age <= 14
  return child.age >= 15
}

// Order the pool for the picker. "Longest wait" breaks ties on age (older first)
// so two children waiting the same length don't sort arbitrarily.
export function sortChildrenForRequest(children: SponsorshipPoolChild[], sort: ChildSort) {
  return [...children].sort((left, right) => {
    if (sort === 'youngest') {
      return (left.age ?? Number.POSITIVE_INFINITY) - (right.age ?? Number.POSITIVE_INFINITY)
    }
    if (sort === 'oldest') {
      return (right.age ?? Number.NEGATIVE_INFINITY) - (left.age ?? Number.NEGATIVE_INFINITY)
    }

    const leftDate = sort === 'longest_in_home' ? joinedSortValue(left) : unmatchedSortValue(left)
    const rightDate = sort === 'longest_in_home' ? joinedSortValue(right) : unmatchedSortValue(right)
    const dateComparison = leftDate.localeCompare(rightDate)
    if (sort === 'longest_wait' && dateComparison === 0) {
      return (right.age ?? Number.NEGATIVE_INFINITY) - (left.age ?? Number.NEGATIVE_INFINITY)
    }
    return dateComparison
  })
}

export function formatMoney(value: number | null) {
  if (value === null) return 'Amount not set'
  return Number.isInteger(value) ? wholeMoneyFormatter.format(value) : moneyFormatter.format(value)
}

export function frequencyLabel(frequency: SponsorshipFrequency) {
  const labels: Record<SponsorshipFrequency, string> = {
    one_time: 'One time',
    weekly: 'Weekly',
    biweekly: 'Every two weeks',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    semiannual: 'Every six months',
    annual: 'Annual',
  }
  return labels[frequency]
}

export function paymentMethodLabel(paymentMethod: SponsorshipPaymentMethod | null) {
  if (!paymentMethod) return null
  const labels: Record<SponsorshipPaymentMethod, string> = {
    square: 'Square',
    pushpay: 'Pushpay',
    check: 'Check',
    stock: 'Stock',
    fidelity: 'Fidelity',
    charity_account: 'Charity account',
    other: 'Other',
  }
  return labels[paymentMethod]
}

export function receiptLabel(value: ReceiptPreference) {
  const labels: Record<ReceiptPreference, string> = {
    unknown: 'Receipt unknown',
    requested: 'Receipt requested',
    not_needed: 'No receipt needed',
  }
  return labels[value]
}

export function contactTypeLabel(value: Sponsor['contact_type']) {
  const labels: Record<Sponsor['contact_type'], string> = {
    sponsor: 'Sponsor',
    donor_only: 'Donor only',
    prospect: 'Prospect',
  }
  return labels[value]
}

export function normalizeEmail(value: string | null) {
  return value?.trim().toLocaleLowerCase() ?? ''
}

export function sponsorToContactDraft(sponsor: Sponsor, emailFallback = sponsor.email ?? ''): ContactDraft {
  return {
    email: sponsor.email ?? emailFallback,
    fullName: sponsor.full_name,
    phone: sponsor.phone ?? '',
    receiptPreference: sponsor.receipt_preference,
    notes: sponsor.notes ?? '',
  }
}

export function searchableText(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(' ').toLocaleLowerCase()
}

export function filterPool(
  list: SponsorshipPoolChild[],
  search: string,
  country: string,
  ageFilter: ChildAgeFilter,
  childSort: ChildSort,
) {
  const query = search.trim().toLocaleLowerCase()
  const filtered = list.filter((child) => {
    const matchesCountry = country === 'all' || child.country === country
    const matchesAge = matchesAgeFilter(child, ageFilter)
    const matchesSearch = query === ''
      || child.display_name.toLocaleLowerCase().includes(query)
      || child.first_name?.toLocaleLowerCase().includes(query)
      || child.last_name?.toLocaleLowerCase().includes(query)
      || child.id_rolf?.toLocaleLowerCase().includes(query)
    return matchesCountry && matchesAge && matchesSearch
  })
  return sortChildrenForRequest(filtered, childSort)
}

export const childAgeFilterOptions: { value: ChildAgeFilter; label: string }[] = [
  { value: 'all', label: 'All ages' },
  { value: '0_5', label: '0-5' },
  { value: '6_10', label: '6-10' },
  { value: '11_14', label: '11-14' },
  { value: '15_plus', label: '15+' },
  { value: 'unknown', label: 'Unknown age' },
]

export const childSortOptions: { value: ChildSort; label: string }[] = [
  { value: 'longest_wait', label: 'Longest unmatched' },
  { value: 'youngest', label: 'Youngest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'longest_in_home', label: 'Longest in home' },
]

export const frequencyOptions: { value: SponsorshipFrequency; label: string }[] = [
  { value: 'one_time', label: 'One time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every two weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semiannual', label: 'Every six months' },
  { value: 'annual', label: 'Annual' },
]

export const paymentOptions: { value: SponsorshipPaymentMethod | ''; label: string }[] = [
  { value: '', label: 'Not recorded' },
  { value: 'square', label: 'Square' },
  { value: 'pushpay', label: 'Pushpay' },
  { value: 'check', label: 'Check' },
  { value: 'stock', label: 'Stock' },
  { value: 'fidelity', label: 'Fidelity' },
  { value: 'charity_account', label: 'Charity account' },
  { value: 'other', label: 'Other' },
]

export function selectedChildrenFromIds(childById: Map<string, SponsorshipPoolChild>, childIds: string[]) {
  return childIds.flatMap((id) => {
    const child = childById.get(id)
    return child ? [child] : []
  })
}

export function pageCountFor(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize))
}
