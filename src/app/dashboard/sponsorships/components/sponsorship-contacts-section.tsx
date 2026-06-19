"use client"

// Read-only directory of saved sponsors/contacts, with text search plus type,
// receipt, and contact-info filters. Everything filters client-side over the list
// the page already loaded, so it stays responsive without extra round trips.
import { useMemo, useState } from 'react'
import {
  MailIcon,
  PhoneIcon,
  SearchIcon,
  UserRoundIcon,
} from 'lucide-react'
import type { PageSize } from '@/app/dashboard/sponsorships/components/sponsorship-matching-types'
import {
  EmptyState,
  FilterButton,
  PaginationControls,
  SectionHeading,
} from '@/app/dashboard/sponsorships/components/sponsorship-matching-ui'
import {
  contactTypeLabel,
  fieldClass,
  labelClass,
  pageCountFor,
  receiptLabel,
  searchableText,
} from '@/app/dashboard/sponsorships/components/sponsorship-matching-utils'
import type {
  ReceiptPreference,
  Sponsor,
} from '@/lib/types'

export function ContactsSection({ sponsors }: { sponsors: Sponsor[] }) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | Sponsor['contact_type']>('all')
  const [receiptFilter, setReceiptFilter] = useState<'all' | ReceiptPreference>('all')
  const [infoFilter, setInfoFilter] = useState<'all' | 'email' | 'phone' | 'notes' | 'missing_phone'>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(5)

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return sponsors.filter((sponsor) => {
      if (kind !== 'all' && sponsor.contact_type !== kind) return false
      if (receiptFilter !== 'all' && sponsor.receipt_preference !== receiptFilter) return false
      const matchesInfo = infoFilter === 'all'
        || (infoFilter === 'email' && Boolean(sponsor.email))
        || (infoFilter === 'phone' && Boolean(sponsor.phone))
        || (infoFilter === 'notes' && Boolean(sponsor.notes))
        || (infoFilter === 'missing_phone' && !sponsor.phone)
      if (!matchesInfo) return false
      if (!normalizedQuery) return true
      return searchableText([
        sponsor.full_name,
        sponsor.email,
        sponsor.phone,
        sponsor.notes,
        contactTypeLabel(sponsor.contact_type),
        receiptLabel(sponsor.receipt_preference),
      ]).includes(normalizedQuery)
    })
  }, [infoFilter, kind, query, receiptFilter, sponsors])
  const pageCount = pageCountFor(filtered.length, pageSize)
  const safePage = Math.min(page, pageCount)
  const paginatedSponsors = useMemo(() => (
    filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  ), [filtered, pageSize, safePage])

  // Every filter change resets to page 1 so you're never stranded on a page that
  // no longer exists once the result count drops.
  const updateKind = (nextKind: typeof kind) => {
    setKind(nextKind)
    setPage(1)
  }

  const updateReceiptFilter = (nextReceiptFilter: typeof receiptFilter) => {
    setReceiptFilter(nextReceiptFilter)
    setPage(1)
  }

  const updateInfoFilter = (nextInfoFilter: typeof infoFilter) => {
    setInfoFilter(nextInfoFilter)
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
          icon={UserRoundIcon}
          title="Contacts"
          meta={`${sponsors.length} contact${sponsors.length === 1 ? '' : 's'}`}
        />
        <div className="mt-3 space-y-2">
          <label className="relative block">
            <span className="sr-only">Search sponsor database</span>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy/55" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder="Search name, email, phone, notes"
              className={`${fieldClass} pl-9`}
            />
          </label>
          <div className="grid gap-2">
            <div className="inline-flex max-w-full overflow-x-auto rounded-md border border-stone bg-ice p-1">
              <FilterButton active={kind === 'all'} label="All" onClick={() => updateKind('all')} />
              <FilterButton active={kind === 'sponsor'} label="Sponsors" onClick={() => updateKind('sponsor')} />
              <FilterButton active={kind === 'donor_only'} label="Donors" onClick={() => updateKind('donor_only')} />
              <FilterButton active={kind === 'prospect'} label="Prospects" onClick={() => updateKind('prospect')} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className={labelClass}>
                Receipt
                <select
                  value={receiptFilter}
                  onChange={(event) => updateReceiptFilter(event.target.value as typeof receiptFilter)}
                  className={`${fieldClass} mt-1.5`}
                >
                  <option value="all">All receipt preferences</option>
                  <option value="unknown">Unknown</option>
                  <option value="requested">Requested</option>
                  <option value="not_needed">Not needed</option>
                </select>
              </label>
              <label className={labelClass}>
                Contact info
                <select
                  value={infoFilter}
                  onChange={(event) => updateInfoFilter(event.target.value as typeof infoFilter)}
                  className={`${fieldClass} mt-1.5`}
                >
                  <option value="all">All contacts</option>
                  <option value="email">Has email</option>
                  <option value="phone">Has phone</option>
                  <option value="missing_phone">Missing phone</option>
                  <option value="notes">Has notes</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      </div>
      {sponsors.length === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyState
            icon={UserRoundIcon}
            title="No event contacts yet"
            body="Contacts saved through the matching form will be listed here."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyState
            icon={SearchIcon}
            title="No contacts match"
            body="Adjust the search or filters to find another saved sponsor."
          />
        </div>
      ) : (
        <>
          <div className="max-h-[42rem] divide-y divide-stone overflow-y-auto">
            {paginatedSponsors.map((sponsor) => (
              <article key={sponsor.id} className="px-4 py-4 motion-safe:transition-colors hover:bg-ice/70 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-navy">{sponsor.full_name}</p>
                    <div className="mt-1 grid gap-1 text-sm text-navy/70">
                      {sponsor.email && (
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <MailIcon className="size-3.5 shrink-0 text-teal" aria-hidden="true" />
                          <span className="truncate">{sponsor.email}</span>
                        </span>
                      )}
                      {sponsor.phone && (
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <PhoneIcon className="size-3.5 shrink-0 text-teal" aria-hidden="true" />
                          <span className="truncate">{sponsor.phone}</span>
                        </span>
                      )}
                      {!sponsor.email && !sponsor.phone && (
                        <span className="text-navy/55">No contact information</span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md bg-ice px-2.5 py-1.5 text-sm font-semibold text-navy/65">
                    {contactTypeLabel(sponsor.contact_type)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-sm font-semibold text-navy/70">
                  <span className="rounded-md border border-stone px-2 py-1">
                    {receiptLabel(sponsor.receipt_preference)}
                  </span>
                  {sponsor.notes && (
                    <span className="min-w-0 rounded-md border border-stone px-2 py-1 break-words">
                      {sponsor.notes}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
          <PaginationControls
            page={safePage}
            pageSize={pageSize}
            total={filtered.length}
            itemLabel="contact"
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
