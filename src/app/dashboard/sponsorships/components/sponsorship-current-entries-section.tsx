"use client"

import { useMemo, useState } from 'react'
import {
  CalendarIcon,
  DollarSignIcon,
  GiftIcon,
  HeartIcon,
  ReceiptIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react'
import type { CurrentSponsorship } from '@/app/dashboard/sponsorships/components/sponsorship-matching-types'
import {
  paymentMethodLabel,
  searchableText,
} from '@/app/dashboard/sponsorships/components/sponsorship-matching-utils'
import type { SponsorshipFrequency } from '@/lib/types'

// ─── Formatting helpers ────────────────────────────────────────────────────────

function frequencySuffix(f: SponsorshipFrequency | null): string {
  if (!f) return ''
  const map: Record<SponsorshipFrequency, string> = {
    one_time: '',
    weekly: '/wk',
    biweekly: '/2wk',
    monthly: '/mo',
    quarterly: '/qtr',
    semiannual: '/6mo',
    annual: '/yr',
  }
  return map[f]
}

function formatCompactAmount(amount: number | null, frequency: SponsorshipFrequency | null): string {
  if (amount === null) return 'No amount'
  const dollars = Number.isInteger(amount)
    ? `$${amount.toLocaleString('en-US')}`
    : `$${amount.toFixed(2)}`
  return `${dollars}${frequencySuffix(frequency)}`
}

function formatDisplayDate(value: string | null | undefined): string {
  if (!value) return 'present'
  try {
    return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return 'Unknown date'
  }
}

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

// ─── EndConfirmModal ───────────────────────────────────────────────────────────

function EndConfirmModal({
  sponsorName,
  isPending,
  onConfirm,
  onCancel,
}: {
  sponsorName: string
  isPending: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/30 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="end-modal-title" className="text-xl font-bold text-navy">
              End sponsorship?
            </h2>
            <p className="mt-0.5 text-base font-semibold text-teal">{sponsorName}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-navy/40 transition-colors hover:bg-stone hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            <XIcon className="size-5" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-3 text-base leading-relaxed text-navy/65">
          This will mark this sponsor record as ended. You can still view it using the{' '}
          <span className="font-semibold text-navy/80">Ended</span> filter.
        </p>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-xl border border-stone px-5 py-2.5 text-base font-semibold text-navy/70 transition-colors hover:bg-ice disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-base font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
          >
            {isPending ? 'Ending…' : 'End sponsorship'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ChildCard ─────────────────────────────────────────────────────────────────

function ChildCard({ child }: { child: NonNullable<CurrentSponsorship['child']> }) {
  return (
    <div className="w-full shrink-0 rounded-xl border border-sky/70 bg-sky/25 px-4 py-3 sm:w-48">
      {child.id_rolf && (
        <p className="text-sm font-semibold text-teal">{child.id_rolf}</p>
      )}
      <p className="mt-0.5 text-base font-bold leading-tight text-navy">{child.display_name}</p>
      {child.country && (
        <p className="mt-0.5 text-sm text-navy/50">{child.country}</p>
      )}
    </div>
  )
}

// ─── SponsorRecordRow ──────────────────────────────────────────────────────────

function SponsorRecordRow({
  record,
  isPending,
  onEndClick,
}: {
  record: CurrentSponsorship
  isPending: boolean
  onEndClick: (id: string) => void
}) {
  const isChild = record.child_id !== null
  const isActive = record.status === 'active'
  const paymentMethod = paymentMethodLabel(record.payment_method)
  const sponsorName = record.sponsor?.full_name ?? 'Unknown sponsor'

  return (
    <article className="flex flex-col gap-4 px-5 py-5 transition-colors hover:bg-ice/60 sm:flex-row sm:items-stretch">
      {/* Icon box */}
      <div
        className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${
          isChild
            ? 'bg-gradient-to-br from-teal/20 to-sky/50 text-teal'
            : 'bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600'
        }`}
        aria-hidden="true"
      >
        {isChild ? <HeartIcon className="size-6" /> : <GiftIcon className="size-6" />}
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        {/* Name + pill */}
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-bold text-navy">{sponsorName}</p>
          <span
            className={`inline-flex rounded-full px-3 py-0.5 text-sm font-semibold ${
              isChild ? 'bg-sky/50 text-teal' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {isChild ? 'Child sponsorship' : 'Donation only'}
          </span>
        </div>
        {record.sponsor?.email && (
          <p className="mt-0.5 text-base text-navy/50">{record.sponsor.email}</p>
        )}

        {/* Metadata */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-base text-navy/55">
          <span className="inline-flex items-center gap-1.5">
            <DollarSignIcon className="size-4 shrink-0 text-teal" aria-hidden="true" />
            {formatCompactAmount(record.amount, record.frequency)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarIcon className="size-4 shrink-0 text-teal" aria-hidden="true" />
            {formatDisplayDate(record.start_date)} – {formatDisplayDate(record.end_date)}
          </span>
          {paymentMethod && (
            <span className="inline-flex items-center gap-1.5">
              <ReceiptIcon className="size-4 shrink-0 text-teal" aria-hidden="true" />
              {paymentMethod}
            </span>
          )}
        </div>

        {record.notes && (
          <p className="mt-2 max-w-prose text-base text-navy/50">{record.notes}</p>
        )}
      </div>

      {/* Right column: child card top, ribbon pinned to bottom */}
      <div className="flex w-full shrink-0 flex-col gap-2 sm:w-48">
        {isChild && record.child && <ChildCard child={record.child} />}
        <div className="mt-auto">
          {isActive ? (
            <button
              type="button"
              onClick={() => onEndClick(record.id)}
              disabled={isPending}
              aria-label={`End sponsorship for ${sponsorName}`}
              className="w-full rounded-lg border border-red-200 bg-red-50 py-1.5 text-center text-xs font-semibold uppercase tracking-widest text-red-500 transition-colors hover:bg-red-100 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
            >
              End sponsorship
            </button>
          ) : (
            <div className="w-full rounded-lg bg-stone py-1.5 text-center text-xs font-semibold uppercase tracking-widest text-navy/40">
              Ended
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

// ─── CurrentEntriesSection ─────────────────────────────────────────────────────

type KindFilter = 'all' | 'sponsorship' | 'donation'
type StatusFilter = 'active' | 'ended' | 'all'

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
  const [kind, setKind] = useState<KindFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const activeCount = currentSponsorships.filter((s) => s.status === 'active').length
  const endedCount = currentSponsorships.filter((s) => s.status === 'ended').length

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    return currentSponsorships.filter((s) => {
      if (kind === 'sponsorship' && s.child_id === null) return false
      if (kind === 'donation' && s.child_id !== null) return false
      if (statusFilter === 'active' && s.status !== 'active') return false
      if (statusFilter === 'ended' && s.status !== 'ended') return false
      if (!q) return true
      const haystack = searchableText([
        s.sponsor?.full_name,
        s.sponsor?.email,
        s.child?.display_name,
        s.child?.id_rolf,
        s.child?.country,
        s.notes,
        paymentMethodLabel(s.payment_method),
      ])
      return haystack.includes(q)
    })
  }, [currentSponsorships, query, kind, statusFilter])

  const confirmingRecord = confirmingId
    ? currentSponsorships.find((s) => s.id === confirmingId)
    : null

  function handleEndClick(id: string) {
    setConfirmingId(id)
  }

  function handleConfirmEnd() {
    if (!confirmingId) return
    onEnd(confirmingId)
    setConfirmingId(null)
  }

  function handleCancelEnd() {
    setConfirmingId(null)
  }

  return (
    <>
      {/* Confirmation modal */}
      {confirmingId && confirmingRecord && (
        <EndConfirmModal
          sponsorName={confirmingRecord.sponsor?.full_name ?? 'This sponsor'}
          isPending={isPending}
          onConfirm={handleConfirmEnd}
          onCancel={handleCancelEnd}
        />
      )}

      <section className="overflow-hidden rounded-2xl border border-stone bg-white shadow-sm">
        {/* Card header */}
        <div className="border-b border-stone px-5 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-lg font-bold text-navy">All Records</span>
              <span className="flex size-7 items-center justify-center rounded-full bg-stone text-sm font-bold text-navy/55">
                {currentSponsorships.length}
              </span>
            </div>
            <div className="flex items-center gap-3 text-base">
              <span>
                <span className="font-bold text-teal">{activeCount}</span>
                <span className="ml-1 text-navy/45">active</span>
              </span>
              <span className="text-stone" aria-hidden="true">·</span>
              <span>
                <span className="font-bold text-navy/40">{endedCount}</span>
                <span className="ml-1 text-navy/45">ended</span>
              </span>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative mt-4">
            <SearchIcon
              className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-navy/35"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value) }}
              placeholder="Search name, email, child, ROLF ID..."
              aria-label="Search sponsor records"
              className="w-full rounded-2xl border border-stone bg-ice py-3 pl-11 pr-4 text-base text-navy outline-none placeholder:text-navy/35 focus:border-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            />
          </div>

          {/* Filters */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-navy/45">Type</span>
              <SegmentedControl
                options={[
                  { value: 'all' as KindFilter, label: 'All' },
                  { value: 'sponsorship' as KindFilter, label: 'Child' },
                  { value: 'donation' as KindFilter, label: 'Donation' },
                ]}
                value={kind}
                onChange={setKind}
              />
            </div>

            <div className="hidden h-5 w-px bg-stone sm:block" aria-hidden="true" />

            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-navy/45">Status</span>
              <SegmentedControl
                options={[
                  { value: 'active' as StatusFilter, label: 'Active' },
                  { value: 'ended' as StatusFilter, label: 'Ended' },
                  { value: 'all' as StatusFilter, label: 'All' },
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            </div>
          </div>
        </div>

        {/* Records list */}
        {currentSponsorships.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-sky/40 text-teal">
              <HeartIcon className="size-7" aria-hidden="true" />
            </div>
            <p className="text-lg font-semibold text-navy">No records yet</p>
            <p className="mt-1 text-base text-navy/55">
              Saved sponsorships and donations will appear here.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-stone text-navy/35">
              <SearchIcon className="size-7" aria-hidden="true" />
            </div>
            <p className="text-lg font-semibold text-navy">No matching records</p>
            <p className="mt-1 text-base text-navy/55">Try changing your search or filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-stone">
            {filtered.map((record) => (
              <SponsorRecordRow
                key={record.id}
                record={record}
                isPending={isPending}
                onEndClick={handleEndClick}
              />
            ))}
          </div>
        )}
      </section>
    </>
  )
}
