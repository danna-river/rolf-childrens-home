"use client"

import { useRef, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  createContactWithRequestsAction,
  endSponsorshipAction,
  type CreateContactRequest,
} from '@/app/dashboard/sponsorships/actions'
import type {
  Sponsor,
  SponsorshipFrequency,
  SponsorshipPaymentMethod,
} from '@/lib/types'

export type SponsorshipPoolChild = {
  id: string
  id_rolf: string | null
  display_name: string
  first_name: string | null
  last_name: string | null
  country: string | null
  year_joined: number | null
  date_joined: string | null
}

export type CurrentSponsorship = {
  id: string
  sponsor_id: string | null
  child_id: string | null
  start_date: string
  end_date: string | null
  amount: number | null
  frequency: SponsorshipFrequency | null
  payment_method: SponsorshipPaymentMethod | null
  notes: string | null
  sponsor: Pick<Sponsor, 'id' | 'full_name' | 'email'> | null
  child: Pick<SponsorshipPoolChild, 'id' | 'id_rolf' | 'display_name' | 'country'> | null
}

type SponsorshipMatchingViewProps = {
  sponsors: Sponsor[]
  currentSponsorships: CurrentSponsorship[]
  pool: SponsorshipPoolChild[]
}

type RequestDraft = {
  key: string
  type: 'sponsorship' | 'donation'
  childIds: string[]
  childSearch: string
  countryFilter: string
  amount: string
  frequency: SponsorshipFrequency
  duration: string
  durationUnit: 'months' | 'years'
  notes: string
}

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 outline-none focus:border-blue-400'

const today = () => new Date().toISOString().slice(0, 10)

function makeDraft(type: RequestDraft['type'], key: string): RequestDraft {
  return {
    key,
    type,
    childIds: [],
    childSearch: '',
    countryFilter: 'all',
    amount: '',
    frequency: 'monthly',
    duration: '1',
    durationUnit: 'years',
    notes: '',
  }
}

function sponsorshipEndDate(duration: number, unit: 'months' | 'years') {
  const [year, month, day] = today().split('-').map(Number)
  const targetMonth = unit === 'months' ? month - 1 + duration : month - 1
  const targetYear = unit === 'years' ? year + duration : year + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay))).toISOString().slice(0, 10)
}

function formatDate(value: string | null) {
  if (!value) return 'Open-ended'
  return new Date(`${value}T12:00:00`).toLocaleDateString()
}

function joinedLabel(child: SponsorshipPoolChild) {
  if (child.date_joined) return formatDate(child.date_joined)
  if (child.year_joined) return String(child.year_joined)
  return 'Unknown'
}

function frequencyLabel(frequency: SponsorshipFrequency) {
  const labels: Record<SponsorshipFrequency, string> = {
    one_time: 'One-time donation',
    weekly: 'Recurring weekly',
    biweekly: 'Recurring every two weeks',
    monthly: 'Recurring monthly',
    quarterly: 'Recurring quarterly',
    semiannual: 'Recurring every six months',
    annual: 'Recurring annually',
  }
  return labels[frequency]
}

function filterPool(list: SponsorshipPoolChild[], search: string, country: string) {
  const query = search.trim().toLocaleLowerCase()
  return list.filter((child) => {
    const matchesCountry = country === 'all' || child.country === country
    const matchesSearch = query === ''
      || child.display_name.toLocaleLowerCase().includes(query)
      || child.first_name?.toLocaleLowerCase().includes(query)
      || child.last_name?.toLocaleLowerCase().includes(query)
      || child.id_rolf?.toLocaleLowerCase().includes(query)
    return matchesCountry && matchesSearch
  })
}

const frequencyOptions: { value: SponsorshipFrequency; label: string }[] = [
  { value: 'one_time', label: 'One-time donation' },
  { value: 'weekly', label: 'Recurring weekly' },
  { value: 'biweekly', label: 'Recurring every two weeks' },
  { value: 'monthly', label: 'Recurring monthly' },
  { value: 'quarterly', label: 'Recurring quarterly' },
  { value: 'semiannual', label: 'Recurring every six months' },
  { value: 'annual', label: 'Recurring annually' },
]

export function SponsorshipMatchingView({
  sponsors,
  currentSponsorships,
  pool,
}: SponsorshipMatchingViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const nextKey = useRef(1)
  const [requests, setRequests] = useState<RequestDraft[]>(() => [makeDraft('sponsorship', 'req-0')])

  const countries = Array.from(
    new Set(pool.flatMap((child) => (child.country ? [child.country] : []))),
  ).sort()
  const longestWaitId = pool[0]?.id ?? ''

  // Each sponsorship request shows the pool minus any children already chosen
  // by the other requests, so the same child can't be matched twice in one form.
  const selections = new Map<string, SponsorshipPoolChild[]>()
  for (const request of requests) {
    if (request.type !== 'sponsorship') {
      selections.set(request.key, [])
      continue
    }
    const claimedElsewhere = new Set(
      requests
        .filter((other) => other.key !== request.key && other.type === 'sponsorship')
        .flatMap((other) => other.childIds),
    )
    const available = pool.filter((child) => !claimedElsewhere.has(child.id))
    selections.set(request.key, filterPool(available, request.childSearch, request.countryFilter))
  }

  const patchRequest = (key: string, patch: Partial<RequestDraft>) => {
    setRequests((prev) => prev.map((request) => (request.key === key ? { ...request, ...patch } : request)))
  }

  const addRequest = () => {
    setRequests((prev) => [...prev, makeDraft('donation', `req-${nextKey.current++}`)])
  }

  const removeRequest = (key: string) => {
    setRequests((prev) => (prev.length > 1 ? prev.filter((request) => request.key !== key) : prev))
  }

  const resetForm = (formElement: HTMLFormElement) => {
    formElement.reset()
    nextKey.current = 1
    setRequests([makeDraft('sponsorship', 'req-0')])
  }

  const runAction = (action: () => Promise<{ error?: string; success?: boolean }>, message: string) => {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await action()
      if (result.error) {
        setError(result.error)
        return
      }
      setSuccess(message)
      router.refresh()
    })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)

    const payload: CreateContactRequest[] = []
    for (const request of requests) {
      if (!request.amount || Number(request.amount) <= 0) {
        setError('Each request needs a donation amount greater than zero.')
        return
      }
      if (request.type === 'sponsorship') {
        if (request.childIds.length === 0) {
          setError('Select at least one child for each child sponsorship.')
          return
        }
        if (!request.duration || Number(request.duration) <= 0) {
          setError('Sponsorship duration must be greater than zero.')
          return
        }
        const endDate = sponsorshipEndDate(Number(request.duration), request.durationUnit)
        for (const childId of request.childIds) {
          payload.push({
            type: 'sponsorship',
            childId,
            startDate: today(),
            endDate,
            amount: request.amount,
            frequency: request.frequency,
            paymentMethod: '',
            notes: request.notes,
          })
        }
      } else {
        payload.push({
          type: 'donation',
          startDate: today(),
          endDate: null,
          amount: request.amount,
          frequency: request.frequency,
          paymentMethod: '',
          notes: request.notes,
        })
      }
    }

    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await createContactWithRequestsAction({
        contact: {
          fullName: String(form.get('fullName') ?? ''),
          email: String(form.get('email') ?? ''),
          phone: '',
          receiptPreference: 'unknown',
          notes: '',
        },
        requests: payload,
      })

      if (result.error) {
        setError(result.error)
        router.refresh()
        return
      }

      const count = result.created ?? payload.length
      setSuccess(`Contact saved with ${count} request${count === 1 ? '' : 's'}.`)
      resetForm(formElement)
      router.refresh()
    })
  }

  const handleEnd = (sponsorshipId: string) => {
    runAction(() => endSponsorshipAction(sponsorshipId), 'Entry ended. Any matched child returned to the pool.')
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-700">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Add Event Contact</h3>
          <p className="text-[11px] text-gray-400">
            Record one contact, then add as many child sponsorships or donations as needed.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <input name="fullName" required placeholder="Name" className={inputClass} />
          <input name="email" type="email" required placeholder="Email" className={inputClass} />
        </div>

        <div className="space-y-3">
          {requests.map((request, index) => (
            <RequestEditor
              key={request.key}
              request={request}
              index={index}
              filtered={selections.get(request.key) ?? []}
              countries={countries}
              longestWaitId={longestWaitId}
              canRemove={requests.length > 1}
              onPatch={(patch) => patchRequest(request.key, patch)}
              onRemove={() => removeRequest(request.key)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={addRequest}
          className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 hover:border-gray-400 hover:text-gray-800"
        >
          + Add another donation request
        </button>

        <div className="flex justify-end border-t border-gray-100 pt-3">
          <button
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            Save Contact
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Current Sponsorships & Donations</h3>
            <p className="text-[11px] text-gray-400">One contact can appear in multiple matches.</p>
          </div>
          <span className="text-xs font-semibold text-gray-500">{currentSponsorships.length} active</span>
        </div>
        {currentSponsorships.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-xs text-gray-400">
            No current sponsorships or donations.
          </div>
        ) : (
          currentSponsorships.map((match) => (
            <div key={match.id} className="rounded-2xl border border-gray-100 bg-white p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {match.child_id
                      ? `${match.sponsor?.full_name ?? 'Legacy donor'} → ${match.child?.display_name ?? 'Unknown child'}`
                      : `${match.sponsor?.full_name ?? 'Legacy donor'} · Donation`}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    {match.child_id
                      ? `${match.child?.id_rolf ?? 'No child ID'} · `
                      : 'General donation · '}
                    {formatDate(match.start_date)} to {formatDate(match.end_date)}
                  </p>
                  {(match.amount !== null || match.frequency || match.payment_method || match.notes) && (
                    <p className="mt-1 text-[11px] text-gray-500">
                      {match.amount !== null ? `$${match.amount}` : ''}
                      {match.frequency ? ` · ${frequencyLabel(match.frequency)}` : ''}
                      {match.payment_method ? ` via ${match.payment_method.replace('_', ' ')}` : ''}
                      {match.notes ? ` · ${match.notes}` : ''}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleEnd(match.id)}
                  disabled={isPending}
                  className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                >
                  End
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Event Contacts</h3>
            <p className="text-[11px] text-gray-400">Includes sponsors, future prospects, and non-sponsor donations.</p>
          </div>
          <span className="text-xs font-semibold text-gray-500">{sponsors.length} contacts</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {sponsors.map((sponsor) => (
            <div key={sponsor.id} className="rounded-2xl border border-gray-100 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">{sponsor.full_name}</p>
                  <p className="text-[11px] text-gray-400">{sponsor.email ?? sponsor.phone ?? 'No contact information'}</p>
                </div>
                <span className="rounded-md bg-gray-50 px-2 py-1 text-[10px] font-bold uppercase text-gray-600">
                  {sponsor.contact_type.replace('_', ' ')}
                </span>
              </div>
              {sponsor.receipt_preference !== 'unknown' && (
                <p className="mt-2 text-[11px] font-semibold text-blue-700">
                  {sponsor.receipt_preference === 'requested' ? 'Tax receipt requested' : 'No receipt needed'}
                </p>
              )}
              {sponsor.notes && <p className="mt-2 whitespace-pre-wrap text-[11px] text-gray-500">{sponsor.notes}</p>}
            </div>
          ))}
          {sponsors.length === 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-xs text-gray-400 sm:col-span-2">
              No event contacts recorded.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

type RequestEditorProps = {
  request: RequestDraft
  index: number
  filtered: SponsorshipPoolChild[]
  countries: string[]
  longestWaitId: string
  canRemove: boolean
  onPatch: (patch: Partial<RequestDraft>) => void
  onRemove: () => void
}

function RequestEditor({
  request,
  index,
  filtered,
  countries,
  longestWaitId,
  canRemove,
  onPatch,
  onRemove,
}: RequestEditorProps) {
  const isSponsorship = request.type === 'sponsorship'

  const toggleChild = (childId: string) => {
    onPatch({
      childIds: request.childIds.includes(childId)
        ? request.childIds.filter((id) => id !== childId)
        : [...request.childIds, childId],
    })
  }

  return (
    <div className={`space-y-3 rounded-xl border p-3 ${isSponsorship ? 'border-emerald-100 bg-emerald-50/50' : 'border-blue-100 bg-blue-50/40'}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
          Request {index + 1}
        </span>
        <div className="flex items-center gap-2">
          <select
            value={request.type}
            onChange={(event) => onPatch({ type: event.target.value as RequestDraft['type'] })}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 outline-none focus:border-blue-400"
          >
            <option value="sponsorship">Child sponsorship</option>
            <option value="donation">Donation</option>
          </select>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {isSponsorship && (
        <div className="space-y-2">
          <div>
            <p className="text-[11px] font-semibold text-gray-600">Manual child match</p>
            <p className="text-[10px] text-gray-400">Search by name or ROLF ID. Select one or more children to match.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_12rem]">
            <input
              value={request.childSearch}
              onChange={(event) => onPatch({ childSearch: event.target.value })}
              placeholder="Search name or ROLF ID..."
              className={inputClass}
            />
            <select
              value={request.countryFilter}
              onChange={(event) => onPatch({ countryFilter: event.target.value })}
              className={inputClass}
            >
              <option value="all">All countries</option>
              {countries.map((country) => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>
          <div className="max-h-52 space-y-2 overflow-y-auto">
            {filtered.map((child) => {
              const selected = request.childIds.includes(child.id)
              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => toggleChild(child.id)}
                  aria-pressed={selected}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                    selected
                      ? 'border-emerald-400 bg-white ring-1 ring-emerald-200'
                      : 'border-gray-100 bg-white/70 hover:border-gray-300'
                  }`}
                >
                  <span>
                    <span className="block text-xs font-semibold text-gray-800">{child.display_name}</span>
                    <span className="block text-[10px] text-gray-400">
                      {child.id_rolf ?? 'No ID'} · {child.country ?? 'No country'} · joined {joinedLabel(child)}
                    </span>
                  </span>
                  {child.id === longestWaitId && (
                    <span className="ml-3 shrink-0 rounded-md bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-700">
                      LONGEST WAIT
                    </span>
                  )}
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div className="rounded-lg border border-gray-100 bg-white p-4 text-center text-[11px] text-gray-400">
                No available children match this search.
              </div>
            )}
          </div>
          <p className="text-[10px] text-gray-400">
            {filtered.length} available result{filtered.length === 1 ? '' : 's'}, oldest waiting first
            {request.childIds.length > 0 ? ` · ${request.childIds.length} selected` : ''}.
          </p>
        </div>
      )}

      <div className={isSponsorship ? 'space-y-2 border-t border-emerald-100 pt-3' : 'space-y-2'}>
        {isSponsorship && (
          <p className="text-[11px] font-semibold text-gray-600">
            Sponsorship terms
            {request.childIds.length > 1 && (
              <span className="font-normal text-gray-400"> · applied to each of the {request.childIds.length} selected children</span>
            )}
          </p>
        )}
        <div className={`grid gap-2 ${isSponsorship ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'}`}>
          <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            {request.frequency === 'one_time' ? 'Donation amount' : 'Amount per payment'}
            <input
              value={request.amount}
              onChange={(event) => onPatch({ amount: event.target.value })}
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder="$ Amount"
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Payment
            <select
              value={request.frequency}
              onChange={(event) => onPatch({ frequency: event.target.value as SponsorshipFrequency })}
              className={`${inputClass} mt-1`}
            >
              {frequencyOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          {isSponsorship && (
            <>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                Active for
                <input
                  value={request.duration}
                  onChange={(event) => onPatch({ duration: event.target.value })}
                  type="number"
                  min="1"
                  step="1"
                  required
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                Duration unit
                <select
                  value={request.durationUnit}
                  onChange={(event) => onPatch({ durationUnit: event.target.value as 'months' | 'years' })}
                  className={`${inputClass} mt-1`}
                >
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </label>
            </>
          )}
        </div>
        {isSponsorship && (
          <p className="text-[10px] text-gray-500">
            Active from today through {formatDate(sponsorshipEndDate(Number(request.duration) || 1, request.durationUnit))}.
          </p>
        )}
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          Notes
          <textarea
            value={request.notes}
            onChange={(event) => onPatch({ notes: event.target.value })}
            rows={2}
            maxLength={2000}
            placeholder="Payment details, special instructions, or other notes..."
            className={`${inputClass} mt-1 resize-y`}
          />
        </label>
      </div>
    </div>
  )
}
