"use client"

import { useMemo, useState } from 'react'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MailIcon,
  PhoneIcon,
  SearchIcon,
  UserRoundIcon,
} from 'lucide-react'
import type { PageSize } from '@/app/dashboard/sponsorships/components/sponsorship-matching-types'
import { pageSizeOptions } from '@/app/dashboard/sponsorships/components/sponsorship-matching-types'
import {
  contactTypeLabel,
  pageCountFor,
  receiptLabel,
  searchableText,
} from '@/app/dashboard/sponsorships/components/sponsorship-matching-utils'
import type { ReceiptPreference, Sponsor } from '@/lib/types'

// ─── SegmentedControl ──────────────────────────────────────────────────────────

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-xl border border-stone bg-stone p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-[10px] px-4 py-1.5 text-sm font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
            value === opt.value
              ? 'bg-white text-navy shadow-sm'
              : 'text-navy/50 hover:text-navy/70'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─── ContactsSection ───────────────────────────────────────────────────────────

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
  const safePage = Math.min(page, Math.max(1, pageCount))
  const paginatedSponsors = useMemo(() => (
    filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  ), [filtered, pageSize, safePage])

  const updateKind = (next: typeof kind) => { setKind(next); setPage(1) }
  const updateReceiptFilter = (next: typeof receiptFilter) => { setReceiptFilter(next); setPage(1) }
  const updateInfoFilter = (next: typeof infoFilter) => { setInfoFilter(next); setPage(1) }
  const updateQuery = (next: string) => { setQuery(next); setPage(1) }

  return (
    <section className="overflow-hidden rounded-2xl border border-stone bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-stone px-5 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-bold text-navy">Contacts</span>
            <span className="flex size-7 items-center justify-center rounded-full bg-stone text-sm font-bold text-navy/55">
              {sponsors.length}
            </span>
          </div>
          <span className="text-base text-navy/45">
            {sponsors.length} contact{sponsors.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Search */}
        <div className="relative mt-4">
          <SearchIcon
            className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-navy/35"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            placeholder="Search name, email, phone, notes..."
            aria-label="Search contacts"
            className="w-full rounded-2xl border border-stone bg-ice py-3 pl-11 pr-4 text-base text-navy outline-none placeholder:text-navy/35 focus:border-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          />
        </div>

        {/* Filters */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-navy/45">Type</span>
            <SegmentedControl
              options={[
                { value: 'all' as const, label: 'All' },
                { value: 'sponsor' as const, label: 'Sponsors' },
                { value: 'donor_only' as const, label: 'Donors' },
                { value: 'prospect' as const, label: 'Prospects' },
              ]}
              value={kind}
              onChange={updateKind}
            />
          </div>

          <div className="hidden h-5 w-px bg-stone sm:block" aria-hidden="true" />

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-navy/45">Receipt</span>
              <select
                value={receiptFilter}
                onChange={(e) => updateReceiptFilter(e.target.value as typeof receiptFilter)}
                className="rounded-xl border border-stone bg-ice px-3 py-1.5 text-sm font-semibold text-navy outline-none focus:border-teal"
              >
                <option value="all">Any</option>
                <option value="unknown">Unknown</option>
                <option value="requested">Requested</option>
                <option value="not_needed">Not needed</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-navy/45">Info</span>
              <select
                value={infoFilter}
                onChange={(e) => updateInfoFilter(e.target.value as typeof infoFilter)}
                className="rounded-xl border border-stone bg-ice px-3 py-1.5 text-sm font-semibold text-navy outline-none focus:border-teal"
              >
                <option value="all">Any</option>
                <option value="email">Has email</option>
                <option value="phone">Has phone</option>
                <option value="missing_phone">Missing phone</option>
                <option value="notes">Has notes</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      {sponsors.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-sky/40 text-teal">
            <UserRoundIcon className="size-7" aria-hidden="true" />
          </div>
          <p className="text-lg font-semibold text-navy">No contacts yet</p>
          <p className="mt-1 text-base text-navy/55">
            Contacts saved through the matching form will appear here.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-stone text-navy/35">
            <SearchIcon className="size-7" aria-hidden="true" />
          </div>
          <p className="text-lg font-semibold text-navy">No matching contacts</p>
          <p className="mt-1 text-base text-navy/55">Try changing your search or filters.</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-stone">
            {paginatedSponsors.map((sponsor) => (
              <article key={sponsor.id} className="flex gap-4 px-5 py-5 transition-colors hover:bg-ice/60">
                {/* Icon box */}
                <div
                  className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-navy/10 to-sky/40 text-navy/50"
                  aria-hidden="true"
                >
                  <UserRoundIcon className="size-6" />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-bold text-navy">{sponsor.full_name}</p>
                    <span className="inline-flex rounded-full bg-sky/50 px-3 py-0.5 text-sm font-semibold text-teal">
                      {contactTypeLabel(sponsor.contact_type)}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-col gap-1 text-base text-navy/60">
                    {sponsor.email && (
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <MailIcon className="size-4 shrink-0 text-teal" aria-hidden="true" />
                        <span className="truncate">{sponsor.email}</span>
                      </span>
                    )}
                    {sponsor.phone && (
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <PhoneIcon className="size-4 shrink-0 text-teal" aria-hidden="true" />
                        <span className="truncate">{sponsor.phone}</span>
                      </span>
                    )}
                    {!sponsor.email && !sponsor.phone && (
                      <span className="text-navy/35">No contact information</span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-lg border border-stone bg-ice px-2.5 py-1 text-sm font-semibold text-navy/55">
                      {receiptLabel(sponsor.receipt_preference)}
                    </span>
                    {sponsor.notes && (
                      <span className="rounded-lg border border-stone bg-ice px-2.5 py-1 text-sm font-semibold text-navy/55 break-words">
                        {sponsor.notes}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between border-t border-stone px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-navy/45">Rows</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value) as PageSize); setPage(1) }}
                  className="rounded-lg border border-stone bg-ice px-2.5 py-1 text-sm font-semibold text-navy outline-none focus:border-teal"
                >
                  {pageSizeOptions.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <span className="mr-2 text-sm text-navy/45">
                  {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="flex size-8 items-center justify-center rounded-lg border border-stone text-navy/50 transition-colors hover:bg-ice disabled:opacity-30"
                  aria-label="Previous page"
                >
                  <ChevronLeftIcon className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={safePage === pageCount}
                  className="flex size-8 items-center justify-center rounded-lg border border-stone text-navy/50 transition-colors hover:bg-ice disabled:opacity-30"
                  aria-label="Next page"
                >
                  <ChevronRightIcon className="size-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
