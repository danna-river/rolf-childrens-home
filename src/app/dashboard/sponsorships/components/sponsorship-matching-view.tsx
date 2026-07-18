"use client"

// Top-level client container for the matching screen. Owns the contact + request
// form state, runs the save/end server actions, and renders the two read-only
// lists below it. The heavier pieces live in their own files; this stitches them
// together and holds the shared state.
import {
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  CircleDollarSignIcon,
  HandshakeIcon,
  HeartHandshakeIcon,
  MailIcon,
  PlusIcon,
  SaveIcon,
  UserRoundIcon,
  UsersIcon,
} from 'lucide-react'
import {
  createContactWithRequestsAction,
  endSponsorshipAction,
  type CreateContactRequest,
} from '@/app/dashboard/sponsorships/actions'
import { ContactsSection } from '@/app/dashboard/sponsorships/components/sponsorship-contacts-section'
import { CurrentEntriesSection } from '@/app/dashboard/sponsorships/components/sponsorship-current-entries-section'
import type {
  ContactDraft,
  RequestDraft,
  SponsorshipMatchingViewProps,
  SponsorshipPoolChild,
} from '@/app/dashboard/sponsorships/components/sponsorship-matching-types'
import {
  ContactMatchBadge,
  Metric,
  SectionHeading,
  StatusMessage,
} from '@/app/dashboard/sponsorships/components/sponsorship-matching-ui'
import { RequestEditor } from '@/app/dashboard/sponsorships/components/sponsorship-request-editor'
import {
  emptyContactDraft,
  fieldClass,
  filterPool,
  labelClass,
  makeDraft,
  normalizeEmail,
  selectedChildrenFromIds,
  sortChildrenForRequest,
  sponsorToContactDraft,
  sponsorshipEndDate,
  today,
} from '@/app/dashboard/sponsorships/components/sponsorship-matching-utils'
import type {
  ReceiptPreference,
  Sponsor,
} from '@/lib/types'

export function SponsorshipMatchingView({
  sponsors,
  currentSponsorships,
  pool,
  countries, // ⚡ ADDED: Receives master country array from server page wrapper
}: SponsorshipMatchingViewProps & { countries: string[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [tab, setTab] = useState<'form' | 'records'>('form')

  const nextKey = useRef(1)
  const [prefilledSponsorId, setPrefilledSponsorId] = useState<string | null>(null)
  const [contact, setContact] = useState<ContactDraft>(emptyContactDraft)
  const [requests, setRequests] = useState<RequestDraft[]>(() => [makeDraft('sponsorship', 'req-0')])

  // Email is the lookup key for existing sponsors. If the same email shows up more
  // than once, keep the oldest record so edits land on the original contact.
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
  
  // ⚡ REMOVED: Static inline extraction array fallback has been dropped to maintain master table sync

  const matchedSponsor = contact.email ? sponsorByEmail.get(normalizeEmail(contact.email)) ?? null : null
  const loadedSponsor = prefilledSponsorId ? matchedSponsor : null
  const longestWaitId = sortChildrenForRequest(pool, 'longest_wait')[0]?.id ?? ''

  const activeRecords = currentSponsorships.filter((s) => s.status === 'active')
  const activeMatches = activeRecords.filter((s) => s.child_id !== null)
  const activeDonations = activeRecords.length - activeMatches.length
  const selectedChildCount = requests.reduce((count, request) => count + request.childIds.length, 0)

  // Build each sponsorship request's child picker list. A child already picked in
  // another request is hidden here so the same child can't be assigned twice in one save.
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
    selections.set(
      request.key,
      filterPool(available, request.childSearch, request.countryFilter, request.ageFilter, request.childSort),
    )
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

  // As the email is typed, auto-fill from a matching sponsor. If the email is then
  // changed away from a match, clear the fields that were prefilled from that sponsor.
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

    // Validate every request and flatten it into the action payload. A sponsorship
    // request with multiple children becomes one payload entry per child.
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

  const tabClass = (active: boolean) =>
    `inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-base font-semibold motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
      active ? 'bg-white text-navy shadow-sm' : 'text-navy/55 hover:bg-white/60 hover:text-navy'
    }`

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={UsersIcon} label="Available children" value={pool.length.toLocaleString()} helper="Open for matching" />
        <Metric icon={HandshakeIcon} label="Active matches" value={activeMatches.length.toLocaleString()} helper="Child sponsorships" />
        <Metric icon={CircleDollarSignIcon} label="General donations" value={activeDonations.toLocaleString()} helper="No child attached" />
        <Metric icon={UserRoundIcon} label="Event contacts" value={sponsors.length.toLocaleString()} helper="Sponsor records" />
      </div>

      <div
        role="tablist"
        aria-label="Sponsorship views"
        className="flex gap-1 rounded-2xl border border-stone bg-ice p-1"
      >
        <button
          type="button"
          role="tab"
          id="tab-form"
          aria-selected={tab === 'form'}
          aria-controls="panel-form"
          onClick={() => setTab('form')}
          className={tabClass(tab === 'form')}
        >
          <PlusIcon className="size-4" aria-hidden="true" />
          New entry
        </button>
        <button
          type="button"
          role="tab"
          id="tab-records"
          aria-selected={tab === 'records'}
          aria-controls="panel-records"
          onClick={() => setTab('records')}
          className={tabClass(tab === 'records')}
        >
          <UsersIcon className="size-4" aria-hidden="true" />
          Records &amp; contacts
        </button>
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

      {tab === 'form' && (
      <form
        id="panel-form"
        role="tabpanel"
        aria-labelledby="tab-form"
        onSubmit={handleSubmit}
        className="overflow-hidden rounded-2xl border border-stone bg-white shadow-sm motion-safe:duration-200 motion-safe:ease-out motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2"
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
          <p className="text-base leading-6 text-navy/60">
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
      )}

      {tab === 'records' && (
      <div
        id="panel-records"
        role="tabpanel"
        aria-labelledby="tab-records"
        className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)] motion-safe:duration-200 motion-safe:ease-out motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2"
      >
        <CurrentEntriesSection
          currentSponsorships={currentSponsorships}
          isPending={isPending}
          onEnd={handleEnd}
        />
        <ContactsSection sponsors={sponsors} />
      </div>
      )}
    </div>
  )
}