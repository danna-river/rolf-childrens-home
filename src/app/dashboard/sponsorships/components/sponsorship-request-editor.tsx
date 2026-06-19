"use client"

// A single request block inside the matching form. Switches between a child
// sponsorship (child picker + duration) and a plain donation. It's fully
// controlled — all state lives in the parent view and comes in via props/onPatch.
import {
  CheckCircle2Icon,
  CircleDollarSignIcon,
  Clock3Icon,
  HeartHandshakeIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react'
import type {
  ChildAgeFilter,
  ChildSort,
  RequestDraft,
  SponsorshipPoolChild,
} from '@/app/dashboard/sponsorships/components/sponsorship-matching-types'
import { RequestTypeButton } from '@/app/dashboard/sponsorships/components/sponsorship-matching-ui'
import {
  childAgeFilterOptions,
  childAgeLabel,
  childSortOptions,
  fieldClass,
  formatDate,
  frequencyOptions,
  joinedLabel,
  labelClass,
  paymentOptions,
  sponsorshipEndDate,
  unmatchedSinceLabel,
} from '@/app/dashboard/sponsorships/components/sponsorship-matching-utils'
import type { SponsorshipFrequency } from '@/lib/types'

type RequestEditorProps = {
  request: RequestDraft
  index: number
  filtered: SponsorshipPoolChild[]
  selectedChildren: SponsorshipPoolChild[]
  countries: string[]
  longestWaitId: string
  canRemove: boolean
  onPatch: (patch: Partial<RequestDraft>) => void
  onRemove: () => void
}

export function RequestEditor({
  request,
  index,
  filtered,
  selectedChildren,
  countries,
  longestWaitId,
  canRemove,
  onPatch,
  onRemove,
}: RequestEditorProps) {
  const isSponsorship = request.type === 'sponsorship'

  // Add or remove a child from this request. Used by both the picker rows and the
  // remove button on the "selected" panel.
  const toggleChild = (childId: string) => {
    onPatch({
      childIds: request.childIds.includes(childId)
        ? request.childIds.filter((id) => id !== childId)
        : [...request.childIds, childId],
    })
  }

  return (
    <div className="rounded-lg border border-stone bg-white shadow-[0_1px_2px_rgba(21,44,75,0.05)] motion-safe:duration-200 motion-safe:ease-out motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2">
      <div className="flex flex-col gap-3 border-b border-stone p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-wide text-navy/50">Request {index + 1}</p>
          <p className="mt-0.5 truncate text-base font-semibold text-navy">
            {isSponsorship ? 'Child sponsorship' : 'General donation'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-stone bg-ice p-1">
            <RequestTypeButton
              active={isSponsorship}
              icon={HeartHandshakeIcon}
              label="Child"
              onClick={() => onPatch({ type: 'sponsorship' })}
            />
            <RequestTypeButton
              active={!isSponsorship}
              icon={CircleDollarSignIcon}
              label="Donation"
              onClick={() => onPatch({ type: 'donation', childIds: [] })}
            />
          </div>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove request ${index + 1}`}
              className="inline-flex size-10 items-center justify-center rounded-md text-red-700 motion-safe:transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
            >
              <Trash2Icon className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4 p-4">
        {isSponsorship && (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.65fr)]">
            <div className="space-y-3">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_11rem_10rem_12rem]">
                <label className={labelClass}>
                  Search
                  <span className="relative mt-1.5 block">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy/35" aria-hidden="true" />
                    <input
                      value={request.childSearch}
                      onChange={(event) => onPatch({ childSearch: event.target.value })}
                      placeholder="Name or ROLF ID"
                      className={`${fieldClass} pl-9`}
                    />
                  </span>
                </label>
                <label className={labelClass}>
                  Country
                  <select
                    value={request.countryFilter}
                    onChange={(event) => onPatch({ countryFilter: event.target.value })}
                    className={`${fieldClass} mt-1.5`}
                  >
                    <option value="all">All countries</option>
                    {countries.map((country) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Age
                  <select
                    value={request.ageFilter}
                    onChange={(event) => onPatch({ ageFilter: event.target.value as ChildAgeFilter })}
                    className={`${fieldClass} mt-1.5`}
                  >
                    {childAgeFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Priority
                  <select
                    value={request.childSort}
                    onChange={(event) => onPatch({ childSort: event.target.value as ChildSort })}
                    className={`${fieldClass} mt-1.5`}
                  >
                    {childSortOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="max-h-72 overflow-y-auto rounded-md border border-stone bg-white">
                {filtered.map((child) => {
                  const selected = request.childIds.includes(child.id)
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => toggleChild(child.id)}
                      aria-pressed={selected}
                      className={`grid w-full gap-2 border-b border-stone px-4 py-4 text-left last:border-b-0 motion-safe:transition motion-safe:duration-150 motion-safe:ease-out sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
                        selected
                          ? 'bg-sky/35 ring-1 ring-inset ring-teal'
                          : 'bg-white hover:bg-ice'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-base font-bold text-navy">{child.display_name}</span>
                        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-navy/55">
                          <span>{child.id_rolf ?? 'No child ID'}</span>
                          <span>{childAgeLabel(child)}</span>
                          <span>{child.country ?? 'No country'}</span>
                          <span>{unmatchedSinceLabel(child)}</span>
                          <span>Joined {joinedLabel(child)}</span>
                        </span>
                      </span>
                      <span className="flex items-center gap-2 sm:justify-end">
                        {child.id === longestWaitId && (
                          <span className="rounded-md bg-amber-50 px-2.5 py-1.5 text-sm font-semibold text-amber-700">
                            Longest unmatched
                          </span>
                        )}
                        <span className={`flex size-7 items-center justify-center rounded-md border ${selected ? 'border-teal bg-teal text-white' : 'border-stone bg-white text-navy/35'}`}>
                          {selected ? (
                            <CheckCircle2Icon className="size-4" aria-hidden="true" />
                          ) : (
                            <PlusIcon className="size-4" aria-hidden="true" />
                          )}
                        </span>
                      </span>
                    </button>
                  )
                })}
                {filtered.length === 0 && (
                  <div className="px-4 py-8 text-center text-base text-navy/50">
                    No available children match this search.
                  </div>
                )}
              </div>
            </div>

            <aside className="rounded-md border border-stone bg-ice p-4">
              <p className="text-sm font-bold uppercase tracking-wide text-navy/50">
                Selected
              </p>
              {selectedChildren.length === 0 ? (
                <p className="mt-2 text-sm leading-6 text-navy/55">
                  No children selected for this request.
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  {selectedChildren.map((child) => (
                    <div key={child.id} className="flex items-center justify-between gap-2 rounded-md bg-white px-3 py-2.5 text-base shadow-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-navy">{child.display_name}</span>
                        <span className="block truncate text-sm text-navy/50">
                          {child.id_rolf ?? 'No child ID'} | {childAgeLabel(child)} | {unmatchedSinceLabel(child)}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleChild(child.id)}
                        aria-label={`Remove ${child.display_name}`}
                        className="flex size-8 shrink-0 items-center justify-center rounded-md text-navy/45 motion-safe:transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                      >
                        <XIcon className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-sm text-navy/50">
                {filtered.length.toLocaleString()} available result{filtered.length === 1 ? '' : 's'} in view.
              </p>
            </aside>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className={labelClass}>
            {request.frequency === 'one_time' ? 'Donation amount' : 'Amount per payment'}
            <input
              value={request.amount}
              onChange={(event) => onPatch({ amount: event.target.value })}
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder="0.00"
              className={`${fieldClass} mt-1.5`}
            />
          </label>
          <label className={labelClass}>
            Frequency
            <select
              value={request.frequency}
              onChange={(event) => onPatch({ frequency: event.target.value as SponsorshipFrequency })}
              className={`${fieldClass} mt-1.5`}
            >
              {frequencyOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Payment method
            <select
              value={request.paymentMethod}
              onChange={(event) => onPatch({ paymentMethod: event.target.value as RequestDraft['paymentMethod'] })}
              className={`${fieldClass} mt-1.5`}
            >
              {paymentOptions.map((option) => (
                <option key={option.value || 'empty'} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          {isSponsorship ? (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
              <label className={labelClass}>
                Active for
                <input
                  value={request.duration}
                  onChange={(event) => onPatch({ duration: event.target.value })}
                  type="number"
                  min="1"
                  step="1"
                  required
                  className={`${fieldClass} mt-1.5`}
                />
              </label>
              <label className={labelClass}>
                Unit
                <select
                  value={request.durationUnit}
                  onChange={(event) => onPatch({ durationUnit: event.target.value as 'months' | 'years' })}
                  className={`${fieldClass} mt-1.5`}
                >
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </label>
            </div>
          ) : (
            <div className="rounded-md border border-stone bg-ice px-3.5 py-2.5">
              <p className="text-sm font-semibold text-navy/60">Record type</p>
              <p className="mt-1 text-base font-semibold text-navy">Donation only</p>
            </div>
          )}
        </div>

        {isSponsorship && (
          <div className="inline-flex min-w-0 items-center gap-2 rounded-md bg-ice px-3.5 py-2.5 text-sm text-navy/65">
            <Clock3Icon className="size-3.5 shrink-0 text-teal" aria-hidden="true" />
            <span className="truncate">
              Active from today through {formatDate(sponsorshipEndDate(Number(request.duration) || 1, request.durationUnit))}
            </span>
          </div>
        )}

        <label className={labelClass}>
          Request notes
          <textarea
            value={request.notes}
            onChange={(event) => onPatch({ notes: event.target.value })}
            rows={2}
            maxLength={2000}
            className={`${fieldClass} mt-1.5 resize-y`}
          />
        </label>
      </div>
    </div>
  )
}
