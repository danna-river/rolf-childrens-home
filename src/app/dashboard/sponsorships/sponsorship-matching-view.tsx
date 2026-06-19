"use client"

import {
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircleIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  CircleDollarSignIcon,
  Clock3Icon,
  HandshakeIcon,
  HeartHandshakeIcon,
  MailIcon,
  PhoneIcon,
  PlusIcon,
  ReceiptIcon,
  SaveIcon,
  SearchIcon,
  Trash2Icon,
  UserRoundIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react'
import {
  createContactWithRequestsAction,
  endSponsorshipAction,
  type CreateContactRequest,
} from '@/app/dashboard/sponsorships/actions'
import type {
  ReceiptPreference,
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
  paymentMethod: SponsorshipPaymentMethod | ''
  duration: string
  durationUnit: 'months' | 'years'
  notes: string
}

type ContactDraft = {
  email: string
  fullName: string
  phone: string
  receiptPreference: ReceiptPreference
  notes: string
}

type IconComponent = typeof UsersIcon

const fieldClass =
  'w-full rounded-md border border-stone bg-white px-3.5 py-2.5 text-base leading-6 text-navy outline-none motion-safe:transition-colors focus:border-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:bg-ice disabled:text-navy/50'

const labelClass = 'block text-sm font-semibold text-navy/70'

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

const today = () => new Date().toISOString().slice(0, 10)
const noCountryFilter = '__no_country__'
const noFrequencyFilter = '__no_frequency__'
const noPaymentFilter = '__no_payment__'

const emptyContactDraft: ContactDraft = {
  email: '',
  fullName: '',
  phone: '',
  receiptPreference: 'unknown',
  notes: '',
}

function makeDraft(type: RequestDraft['type'], key: string): RequestDraft {
  return {
    key,
    type,
    childIds: [],
    childSearch: '',
    countryFilter: 'all',
    amount: '',
    frequency: 'monthly',
    paymentMethod: '',
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
  if (!value) return 'Open ended'
  return new Date(`${value}T12:00:00`).toLocaleDateString()
}

function joinedLabel(child: SponsorshipPoolChild) {
  if (child.date_joined) return formatDate(child.date_joined)
  if (child.year_joined) return String(child.year_joined)
  return 'Unknown'
}

function formatMoney(value: number | null) {
  if (value === null) return 'Amount not set'
  return Number.isInteger(value) ? wholeMoneyFormatter.format(value) : moneyFormatter.format(value)
}

function frequencyLabel(frequency: SponsorshipFrequency) {
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

function paymentMethodLabel(paymentMethod: SponsorshipPaymentMethod | null) {
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

function receiptLabel(value: ReceiptPreference) {
  const labels: Record<ReceiptPreference, string> = {
    unknown: 'Receipt unknown',
    requested: 'Receipt requested',
    not_needed: 'No receipt needed',
  }
  return labels[value]
}

function contactTypeLabel(value: Sponsor['contact_type']) {
  const labels: Record<Sponsor['contact_type'], string> = {
    sponsor: 'Sponsor',
    donor_only: 'Donor only',
    prospect: 'Prospect',
  }
  return labels[value]
}

function normalizeEmail(value: string | null) {
  return value?.trim().toLocaleLowerCase() ?? ''
}

function sponsorToContactDraft(sponsor: Sponsor, emailFallback = sponsor.email ?? ''): ContactDraft {
  return {
    email: sponsor.email ?? emailFallback,
    fullName: sponsor.full_name,
    phone: sponsor.phone ?? '',
    receiptPreference: sponsor.receipt_preference,
    notes: sponsor.notes ?? '',
  }
}

function searchableText(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(' ').toLocaleLowerCase()
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
  { value: 'one_time', label: 'One time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every two weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semiannual', label: 'Every six months' },
  { value: 'annual', label: 'Annual' },
]

const paymentOptions: { value: SponsorshipPaymentMethod | ''; label: string }[] = [
  { value: '', label: 'Not recorded' },
  { value: 'square', label: 'Square' },
  { value: 'pushpay', label: 'Pushpay' },
  { value: 'check', label: 'Check' },
  { value: 'stock', label: 'Stock' },
  { value: 'fidelity', label: 'Fidelity' },
  { value: 'charity_account', label: 'Charity account' },
  { value: 'other', label: 'Other' },
]

function selectedChildrenFromIds(childById: Map<string, SponsorshipPoolChild>, childIds: string[]) {
  return childIds.flatMap((id) => {
    const child = childById.get(id)
    return child ? [child] : []
  })
}

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
  const [prefilledSponsorId, setPrefilledSponsorId] = useState<string | null>(null)
  const [contact, setContact] = useState<ContactDraft>(emptyContactDraft)
  const [requests, setRequests] = useState<RequestDraft[]>(() => [makeDraft('sponsorship', 'req-0')])

  const sponsorByEmail = useMemo(() => {
    const map = new Map<string, Sponsor>()
    for (const sponsor of sponsors) {
      const email = normalizeEmail(sponsor.email)
      const current = map.get(email)
      if (email && (!current || sponsor.created_at < current.created_at)) {
        map.set(email, sponsor)
      }
    }
    return map
  }, [sponsors])

  const childById = useMemo(() => new Map(pool.map((child) => [child.id, child])), [pool])
  const countries = Array.from(
    new Set(pool.flatMap((child) => (child.country ? [child.country] : []))),
  ).sort()
  const matchedSponsor = contact.email ? sponsorByEmail.get(normalizeEmail(contact.email)) ?? null : null
  const loadedSponsor = prefilledSponsorId ? matchedSponsor : null
  const longestWaitId = pool[0]?.id ?? ''

  const activeMatches = currentSponsorships.filter((sponsorship) => sponsorship.child_id !== null)
  const activeDonations = currentSponsorships.length - activeMatches.length
  const selectedChildCount = requests.reduce((count, request) => count + request.childIds.length, 0)

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
    setContact(emptyContactDraft)
    setPrefilledSponsorId(null)
    setRequests([makeDraft('sponsorship', 'req-0')])
  }

  const updateContact = (patch: Partial<ContactDraft>) => {
    setContact((prev) => ({ ...prev, ...patch }))
  }

  const updateContactEmail = (email: string) => {
    const sponsor = sponsorByEmail.get(normalizeEmail(email))
    if (sponsor) {
      setContact(sponsorToContactDraft(sponsor, email))
      setPrefilledSponsorId(sponsor.id)
      return
    }

    setContact((prev) => (
      prefilledSponsorId
        ? { ...emptyContactDraft, email }
        : { ...prev, email }
    ))
    setPrefilledSponsorId(null)
  }

  const clearMatchedContact = () => {
    setContact(emptyContactDraft)
    setPrefilledSponsorId(null)
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
            paymentMethod: request.paymentMethod,
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
          paymentMethod: request.paymentMethod,
          notes: request.notes,
        })
      }
    }

    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await createContactWithRequestsAction({
        contact: {
          fullName: contact.fullName,
          email: contact.email,
          phone: contact.phone,
          receiptPreference: contact.receiptPreference,
          notes: contact.notes,
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={UsersIcon} label="Available children" value={pool.length.toLocaleString()} helper="Open for matching" />
        <Metric icon={HandshakeIcon} label="Active matches" value={activeMatches.length.toLocaleString()} helper="Child sponsorships" />
        <Metric icon={CircleDollarSignIcon} label="General donations" value={activeDonations.toLocaleString()} helper="No child attached" />
        <Metric icon={UserRoundIcon} label="Event contacts" value={sponsors.length.toLocaleString()} helper="Sponsor records" />
      </div>

      {error && (
        <StatusMessage tone="error">
          {error}
        </StatusMessage>
      )}
      {success && (
        <StatusMessage tone="success">
          {success}
        </StatusMessage>
      )}

      <form
        onSubmit={handleSubmit}
        className="overflow-hidden rounded-lg border border-stone bg-white shadow-[0_1px_2px_rgba(21,44,75,0.06)] motion-safe:duration-200 motion-safe:ease-out motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2"
      >
        <section className="border-b border-stone p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <SectionHeading
              icon={UserRoundIcon}
              title="Contact"
              meta="Email-first sponsor lookup"
            />
            <ContactMatchBadge sponsor={loadedSponsor} />
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,0.7fr)]">
            <label className={labelClass}>
              Email
              <span className="relative mt-1.5 block">
                <MailIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy/35" aria-hidden="true" />
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={contact.email}
                  onChange={(event) => updateContactEmail(event.target.value)}
                  placeholder="sponsor@example.com"
                  className={`${fieldClass} pl-9`}
                />
              </span>
            </label>
            <label className={labelClass}>
              Full name
              <input
                name="fullName"
                required
                autoComplete="name"
                value={contact.fullName}
                onChange={(event) => updateContact({ fullName: event.target.value })}
                className={`${fieldClass} mt-1.5`}
              />
            </label>
            <label className={labelClass}>
              Phone
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                value={contact.phone}
                onChange={(event) => updateContact({ phone: event.target.value })}
                className={`${fieldClass} mt-1.5`}
              />
            </label>
            <label className={labelClass}>
              Receipt
              <select
                name="receiptPreference"
                value={contact.receiptPreference}
                onChange={(event) => updateContact({ receiptPreference: event.target.value as ReceiptPreference })}
                className={`${fieldClass} mt-1.5`}
              >
                <option value="unknown">Unknown</option>
                <option value="requested">Requested</option>
                <option value="not_needed">Not needed</option>
              </select>
            </label>
          </div>
          <label className={`${labelClass} mt-3`}>
            Contact notes
            <textarea
              name="contactNotes"
              value={contact.notes}
              onChange={(event) => updateContact({ notes: event.target.value })}
              rows={2}
              maxLength={2000}
              className={`${fieldClass} mt-1.5 resize-y`}
            />
          </label>
          {loadedSponsor && (
            <div className="mt-3 flex flex-col gap-2 rounded-md border border-teal/25 bg-sky/30 p-3 text-sm text-navy sm:flex-row sm:items-center sm:justify-between">
              <p className="min-w-0">
                <span className="font-semibold">Existing sponsor loaded.</span>{' '}
                Edits here update the saved contact when you save this request.
              </p>
              <button
                type="button"
                onClick={clearMatchedContact}
                className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-md border border-stone bg-white px-3 text-base font-semibold text-navy motion-safe:transition-colors hover:bg-ice focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal sm:w-auto"
              >
                Clear details
              </button>
            </div>
          )}
        </section>

        <section className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SectionHeading
              icon={HeartHandshakeIcon}
              title="Requests"
              meta={`${requests.length} request${requests.length === 1 ? '' : 's'} | ${selectedChildCount} child${selectedChildCount === 1 ? '' : 'ren'} selected`}
            />
            <button
              type="button"
              onClick={addRequest}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-dashed border-stone bg-white px-4 text-base font-semibold text-navy motion-safe:transition motion-safe:duration-150 motion-safe:ease-out hover:border-teal hover:bg-ice focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal active:scale-[0.98] sm:w-auto"
            >
              <PlusIcon className="size-4" aria-hidden="true" />
              Add request
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {requests.map((request, index) => (
              <RequestEditor
                key={request.key}
                request={request}
                index={index}
                filtered={selections.get(request.key) ?? []}
                selectedChildren={selectedChildrenFromIds(childById, request.childIds)}
                countries={countries}
                longestWaitId={longestWaitId}
                canRemove={requests.length > 1}
                onPatch={(patch) => patchRequest(request.key, patch)}
                onRemove={() => removeRequest(request.key)}
              />
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-3 border-t border-stone bg-ice px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-sm leading-6 text-navy/60">
            Children are reserved only after the contact is saved.
          </p>
          <button
            disabled={isPending}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-navy px-4 text-base font-semibold text-white shadow-sm motion-safe:transition motion-safe:duration-150 motion-safe:ease-out hover:bg-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
          >
            <SaveIcon className="size-4" aria-hidden="true" />
            {isPending ? 'Saving' : 'Save contact'}
          </button>
        </div>
      </form>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
        <CurrentEntriesSection
          currentSponsorships={currentSponsorships}
          isPending={isPending}
          onEnd={handleEnd}
        />
        <ContactsSection sponsors={sponsors} />
      </div>
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: IconComponent
  label: string
  value: string
  helper: string
}) {
  return (
    <div className="rounded-lg border border-stone bg-white p-4 shadow-[0_1px_2px_rgba(21,44,75,0.05)] sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-navy/60">{label}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-navy">{value}</p>
          <p className="mt-1 truncate text-sm text-navy/50">{helper}</p>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-sky/65 text-teal">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
    </div>
  )
}

function StatusMessage({
  tone,
  children,
}: {
  tone: 'error' | 'success'
  children: ReactNode
}) {
  const Icon = tone === 'error' ? AlertCircleIcon : CheckCircle2Icon
  const toneClass = tone === 'error'
    ? 'border-red-100 bg-red-50 text-red-700'
    : 'border-emerald-100 bg-emerald-50 text-emerald-700'

  return (
    <div className={`flex items-start gap-2 rounded-lg border p-4 text-base leading-6 motion-safe:duration-150 motion-safe:ease-out motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 ${toneClass}`}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <p className="min-w-0">{children}</p>
    </div>
  )
}

function SectionHeading({
  icon: Icon,
  title,
  meta,
}: {
  icon: IconComponent
  title: string
  meta: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-ice text-teal ring-1 ring-stone">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-navy">{title}</h2>
        <p className="truncate text-sm text-navy/55">{meta}</p>
      </div>
    </div>
  )
}

function ContactMatchBadge({ sponsor }: { sponsor: Sponsor | null }) {
  if (!sponsor) {
    return (
      <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-stone bg-white px-3 text-sm font-semibold text-navy/60">
        <SearchIcon className="size-4 text-teal" aria-hidden="true" />
        New or unmatched email
      </span>
    )
  }

  return (
    <span className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-md border border-teal/25 bg-sky/35 px-3 text-sm font-semibold text-navy">
      <CheckCircle2Icon className="size-4 shrink-0 text-teal" aria-hidden="true" />
      <span className="min-w-0 truncate">
        {sponsor.full_name} · {contactTypeLabel(sponsor.contact_type)}
      </span>
    </span>
  )
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-10 shrink-0 items-center justify-center rounded-sm px-3 text-sm font-bold motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
        active
          ? 'bg-white text-navy shadow-sm'
          : 'text-navy/55 hover:text-navy'
      }`}
    >
      {label}
    </button>
  )
}

function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: IconComponent
  title: string
  body: string
}) {
  return (
    <div className="rounded-lg border border-dashed border-stone bg-white px-5 py-10 text-center">
      <Icon className="mx-auto size-7 text-teal" aria-hidden="true" />
      <p className="mt-3 text-base font-semibold text-navy">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-base leading-7 text-navy/60">{body}</p>
    </div>
  )
}

function CurrentEntriesSection({
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

  const countryOptions = useMemo(() => (
    Array.from(
      new Set(currentSponsorships.flatMap((match) => (match.child?.country ? [match.child.country] : []))),
    ).sort()
  ), [currentSponsorships])
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
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search sponsor, email, child, country, notes"
              className={`${fieldClass} pl-9`}
            />
          </label>
          <div className="inline-flex rounded-md border border-stone bg-ice p-1">
            <FilterButton active={kind === 'all'} label="All" onClick={() => setKind('all')} />
            <FilterButton active={kind === 'sponsorship'} label="Child" onClick={() => setKind('sponsorship')} />
            <FilterButton active={kind === 'donation'} label="Donation" onClick={() => setKind('donation')} />
          </div>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <label className={labelClass}>
            Country
            <select
              value={countryFilter}
              onChange={(event) => setCountryFilter(event.target.value)}
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
              onChange={(event) => setFrequencyFilter(event.target.value)}
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
              onChange={(event) => setPaymentFilter(event.target.value)}
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
        <div className="max-h-[48rem] divide-y divide-stone overflow-y-auto">
          {filtered.map((match) => {
            const childLabel = match.child_id
              ? match.child?.display_name ?? 'Unknown child'
              : 'General donation'
            const sponsorLabel = match.sponsor?.full_name ?? 'Legacy donor'
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
                      <p className="truncate text-base font-bold text-navy">{childLabel}</p>
                      <p className="truncate text-sm text-navy/55">{sponsorLabel}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-navy/60">
                    {match.child_id && <span>{match.child?.id_rolf ?? 'No child ID'}</span>}
                    {match.child?.country && <span>{match.child.country}</span>}
                    {match.notes && <span className="min-w-0 break-words">{match.notes}</span>}
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
      )}
    </section>
  )
}

function ContactsSection({ sponsors }: { sponsors: Sponsor[] }) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | Sponsor['contact_type']>('all')
  const [receiptFilter, setReceiptFilter] = useState<'all' | ReceiptPreference>('all')
  const [infoFilter, setInfoFilter] = useState<'all' | 'email' | 'phone' | 'notes' | 'missing_phone'>('all')

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
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy/35" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, email, phone, notes"
              className={`${fieldClass} pl-9`}
            />
          </label>
          <div className="grid gap-2">
            <div className="inline-flex max-w-full overflow-x-auto rounded-md border border-stone bg-ice p-1">
              <FilterButton active={kind === 'all'} label="All" onClick={() => setKind('all')} />
              <FilterButton active={kind === 'sponsor'} label="Sponsors" onClick={() => setKind('sponsor')} />
              <FilterButton active={kind === 'donor_only'} label="Donors" onClick={() => setKind('donor_only')} />
              <FilterButton active={kind === 'prospect'} label="Prospects" onClick={() => setKind('prospect')} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className={labelClass}>
                Receipt
                <select
                  value={receiptFilter}
                  onChange={(event) => setReceiptFilter(event.target.value as 'all' | ReceiptPreference)}
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
                  onChange={(event) => setInfoFilter(event.target.value as typeof infoFilter)}
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
        <div className="max-h-[42rem] divide-y divide-stone overflow-y-auto">
          {filtered.map((sponsor) => (
            <article key={sponsor.id} className="px-4 py-4 motion-safe:transition-colors hover:bg-ice/70 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-navy">{sponsor.full_name}</p>
                  <div className="mt-1 grid gap-1 text-sm text-navy/60">
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
                      <span className="text-navy/40">No contact information</span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 rounded-md bg-ice px-2.5 py-1.5 text-sm font-semibold text-navy/65">
                  {contactTypeLabel(sponsor.contact_type)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-sm font-semibold text-navy/60">
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
      )}
    </section>
  )
}

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

function RequestEditor({
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
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
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
                          <span>{child.country ?? 'No country'}</span>
                          <span>Joined {joinedLabel(child)}</span>
                        </span>
                      </span>
                      <span className="flex items-center gap-2 sm:justify-end">
                        {child.id === longestWaitId && (
                          <span className="rounded-md bg-amber-50 px-2.5 py-1.5 text-sm font-semibold text-amber-700">
                            Longest wait
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
                        <span className="block truncate text-sm text-navy/50">{child.id_rolf ?? 'No child ID'}</span>
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

function RequestTypeButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: IconComponent
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-sm px-3 text-sm font-bold motion-safe:transition motion-safe:duration-150 motion-safe:ease focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
        active
          ? 'bg-white text-navy shadow-sm'
          : 'text-navy/55 hover:text-navy'
      }`}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
  )
}
