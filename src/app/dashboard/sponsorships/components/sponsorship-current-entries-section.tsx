"use client"

// The "active records" list: every live child sponsorship and standalone donation
// in one place, with search and country/frequency/payment filters. Ending a record
// is delegated back up to the view via onEnd.
import { useMemo, useState } from 'react'
import {
  CalendarDaysIcon,
  CircleDollarSignIcon,
  HandshakeIcon,
  ReceiptIcon,
  SearchIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react'
import type {
  CurrentSponsorship,
  PageSize,
} from '@/app/dashboard/sponsorships/components/sponsorship-matching-types'
import {
  EmptyState,
  FilterButton,
  PaginationControls,
  SectionHeading,
} from '@/app/dashboard/sponsorships/components/sponsorship-matching-ui'
import {
  fieldClass,
  formatDate,
  formatMoney,
  frequencyLabel,
  frequencyOptions,
  labelClass,
  noCountryFilter,
  noFrequencyFilter,
  noPaymentFilter,
  pageCountFor,
  paymentMethodLabel,
  paymentOptions,
  searchableText,
} from '@/app/dashboard/sponsorships/components/sponsorship-matching-utils'

export function CurrentEntriesSection({
  currentSponsorships,
  isPending,
  onEnd,
}: {
  currentSponsorships: CurrentSponsorship[]
  isPending: boolean
  onEnd: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | 'sponsorship' | 'donation'>('all')
  const [countryFilter, setCountryFilter] = useState('all')
  const [frequencyFilter, setFrequencyFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(5)

  const countryOptions = useMemo(() => (
    Array.from(
      new Set(currentSponsorships.flatMap((match) => (match.child?.country ? [match.child.country] : []))),
    ).sort()
  ), [currentSponsorships])
  // Only offer the explicit "no country / frequency / method" filter options when
  // there's actually a record missing that field, so the dropdowns stay tidy.
  const hasCountrylessRecords = currentSponsorships.some((match) => !match.child?.country)
  const hasRecordsWithoutFrequency = currentSponsorships.some((match) => match.frequency === null)
  const hasRecordsWithoutPayment = currentSponsorships.some((match) => match.payment_method === null)

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return currentSponsorships.filter((match) => {
      const matchesKind = kind === 'all'
        || (kind === 'sponsorship' && match.child_id !== null)
        || (kind === 'donation' && match.child_id === null)
      const matchesCountry = countryFilter === 'all'
        || (countryFilter === noCountryFilter ? !match.child?.country : match.child?.country === countryFilter)
      const matchesFrequency = frequencyFilter === 'all'
        || (frequencyFilter === noFrequencyFilter ? match.frequency === null : match.frequency === frequencyFilter)
      const matchesPayment = paymentFilter === 'all'
        || (paymentFilter === noPaymentFilter ? match.payment_method === null : match.payment_method === paymentFilter)
      if (!matchesKind || !matchesCountry || !matchesFrequency || !matchesPayment) return false

      if (!normalizedQuery) return true
      const haystack = searchableText([
        match.sponsor?.full_name,
        match.sponsor?.email,
        match.child?.display_name,
        match.child?.id_rolf,
        match.child?.country,
        match.notes,
        match.frequency ? frequencyLabel(match.frequency) : null,
        paymentMethodLabel(match.payment_method),
      ])
      return haystack.includes(normalizedQuery)
    })
  }, [countryFilter, currentSponsorships, frequencyFilter, kind, paymentFilter, query])
  const pageCount = pageCountFor(filtered.length, pageSize)
  const safePage = Math.min(page, pageCount)
  const paginatedRecords = useMemo(() => (
    filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  ), [filtered, pageSize, safePage])

  const updateKind = (nextKind: typeof kind) => {
    setKind(nextKind)
    setPage(1)
  }

  const updateCountryFilter = (nextCountryFilter: string) => {
    setCountryFilter(nextCountryFilter)
    setPage(1)
  }

  const updateFrequencyFilter = (nextFrequencyFilter: string) => {
    setFrequencyFilter(nextFrequencyFilter)
    setPage(1)
  }

  const updatePaymentFilter = (nextPaymentFilter: string) => {
    setPaymentFilter(nextPaymentFilter)
    setPage(1)
  }

  const updateQuery = (nextQuery: string) => {
    setQuery(nextQuery)
    setPage(1)
  }

  return (
    <section className="overflow-hidden rounded-lg border border-stone bg-white shadow-[0_1px_2px_rgba(21,44,75,0.06)]">
      <div className="border-b border-stone px-4 py-4 sm:px-5">
        <SectionHeading
          icon={HandshakeIcon}
          title="Active records"
          meta={`${currentSponsorships.length} active entr${currentSponsorships.length === 1 ? 'y' : 'ies'}`}
        />
        <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
          <label className="relative block">
            <span className="sr-only">Search active records</span>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy/35" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder="Search sponsor, email, child, country, notes"
              className={`${fieldClass} pl-9`}
            />
          </label>
          <div className="inline-flex rounded-md border border-stone bg-ice p-1">
            <FilterButton active={kind === 'all'} label="All" onClick={() => updateKind('all')} />
            <FilterButton active={kind === 'sponsorship'} label="Child" onClick={() => updateKind('sponsorship')} />
            <FilterButton active={kind === 'donation'} label="Donation" onClick={() => updateKind('donation')} />
          </div>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <label className={labelClass}>
            Country
            <select
              value={countryFilter}
              onChange={(event) => updateCountryFilter(event.target.value)}
              className={`${fieldClass} mt-1.5`}
            >
              <option value="all">All countries</option>
              {countryOptions.map((country) => (
                <option key={country} value={country}>{country}</option>
              ))}
              {hasCountrylessRecords && <option value={noCountryFilter}>No country</option>}
            </select>
          </label>
          <label className={labelClass}>
            Frequency
            <select
              value={frequencyFilter}
              onChange={(event) => updateFrequencyFilter(event.target.value)}
              className={`${fieldClass} mt-1.5`}
            >
              <option value="all">All frequencies</option>
              {frequencyOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
              {hasRecordsWithoutFrequency && <option value={noFrequencyFilter}>No frequency</option>}
            </select>
          </label>
          <label className={labelClass}>
            Payment method
            <select
              value={paymentFilter}
              onChange={(event) => updatePaymentFilter(event.target.value)}
              className={`${fieldClass} mt-1.5`}
            >
              <option value="all">All methods</option>
              {paymentOptions.filter((option) => option.value).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
              {hasRecordsWithoutPayment && <option value={noPaymentFilter}>No method</option>}
            </select>
          </label>
        </div>
      </div>
      {currentSponsorships.length === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyState
            icon={HandshakeIcon}
            title="No active sponsorships or donations"
            body="Saved requests will appear here with their contact, child, amount, and term."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyState
            icon={SearchIcon}
            title="No entries match"
            body="Adjust the search or filters to return active sponsorships and donations."
          />
        </div>
      ) : (
        <>
          <div className="max-h-[48rem] divide-y divide-stone overflow-y-auto">
            {paginatedRecords.map((match) => {
              const childLabel = match.child_id
                ? match.child?.display_name ?? 'Unknown child'
                : 'General donation'
              const sponsorLabel = match.sponsor?.full_name ?? 'Unknown sponsor'
              const recordTypeLabel = match.child_id ? 'Child sponsorship' : 'Donation only'
              const paymentMethod = paymentMethodLabel(match.payment_method)
              return (
                <article
                  key={match.id}
                  className="grid gap-4 px-4 py-4 motion-safe:transition-colors hover:bg-ice/70 sm:grid-cols-[minmax(0,1.4fr)_minmax(210px,0.7fr)_auto] sm:items-center sm:px-5"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`flex size-8 shrink-0 items-center justify-center rounded-md ${match.child_id ? 'bg-sky/70 text-teal' : 'bg-emerald-50 text-emerald-700'}`}>
                        {match.child_id ? (
                          <UsersIcon className="size-4" aria-hidden="true" />
                        ) : (
                          <CircleDollarSignIcon className="size-4" aria-hidden="true" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-navy/50">Sponsor</p>
                        <p className="truncate text-base font-bold text-navy">{sponsorLabel}</p>
                        {match.sponsor?.email && (
                          <p className="truncate text-sm text-navy/55">{match.sponsor.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-navy/65 sm:grid-cols-2">
                      <span className="min-w-0 rounded-md border border-stone bg-ice px-3 py-2">
                        <span className="block font-semibold text-navy/50">{recordTypeLabel}</span>
                        <span className="block truncate font-semibold text-navy">{childLabel}</span>
                      </span>
                      {match.child_id && (
                        <span className="min-w-0 rounded-md border border-stone bg-white px-3 py-2">
                          <span className="block font-semibold text-navy/50">Child details</span>
                          <span className="block truncate font-semibold text-navy">
                            {match.child?.id_rolf ?? 'No child ID'}
                            {match.child?.country ? ` | ${match.child.country}` : ''}
                          </span>
                        </span>
                      )}
                      {match.notes && (
                        <span className="min-w-0 rounded-md border border-stone bg-white px-3 py-2 sm:col-span-2">
                          <span className="block font-semibold text-navy/50">Notes</span>
                          <span className="block break-words font-semibold text-navy">{match.notes}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-1 text-sm text-navy/65">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <CircleDollarSignIcon className="size-3.5 shrink-0 text-teal" aria-hidden="true" />
                      <span className="truncate">
                        {formatMoney(match.amount)}
                        {match.frequency ? ` ${frequencyLabel(match.frequency).toLocaleLowerCase()}` : ''}
                      </span>
                    </span>
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <CalendarDaysIcon className="size-3.5 shrink-0 text-teal" aria-hidden="true" />
                      <span className="truncate">{formatDate(match.start_date)} to {formatDate(match.end_date)}</span>
                    </span>
                    {paymentMethod && (
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <ReceiptIcon className="size-3.5 shrink-0 text-teal" aria-hidden="true" />
                        <span className="truncate">{paymentMethod}</span>
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onEnd(match.id)}
                    disabled={isPending}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-red-100 bg-red-50 px-4 text-base font-semibold text-red-700 motion-safe:transition motion-safe:duration-150 motion-safe:ease hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
                  >
                    <XIcon className="size-4" aria-hidden="true" />
                    End
                  </button>
                </article>
              )
            })}
          </div>
          <PaginationControls
            page={safePage}
            pageSize={pageSize}
            total={filtered.length}
            itemLabel="record"
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize)
              setPage(1)
            }}
          />
        </>
      )}
    </section>
  )
}
