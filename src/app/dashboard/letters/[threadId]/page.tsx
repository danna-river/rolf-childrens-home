import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  Clock3Icon,
  LockIcon,
  MailIcon,
  MapPinIcon,
  MessageSquareReplyIcon,
  ShieldCheckIcon,
  StickyNoteIcon,
  UserIcon,
  XCircleIcon,
  type LucideIcon,
} from 'lucide-react'
import { requireAuth } from '@/lib/auth'
import { isAdminRole, isStaffRole } from '@/lib/profiles'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePhotoSrc } from '@/lib/childMedia'
import { ThreadActionPanel } from '../components/thread-action-panel'
import type { PenPalDirection, PenPalMessageStatus, PenPalThreadStatus } from '@/lib/types'

type ThreadRow = {
  id: string
  sponsorship_id: string
  sponsor_id: string
  child_id: string
  status: PenPalThreadStatus
  closed_reason: string | null
  last_message_at: string | null
  created_at: string
}

type MessageRow = {
  id: string
  thread_id: string
  direction: PenPalDirection
  status: PenPalMessageStatus
  raw_body: string
  approved_body: string | null
  reviewed_at: string | null
  delivered_at: string | null
  published_at: string | null
  rejection_reason: string | null
  created_at: string
}

type EventRow = {
  id: string
  thread_id: string
  message_id: string | null
  actor_profile_id: string | null
  event_type: string
  notes: string | null
  created_at: string
}

type ChildRow = {
  id: string
  id_rolf: string | null
  display_name: string
  first_name: string | null
  last_name: string | null
  country: string | null
  profile_photo: string | null
}

type SponsorRow = {
  id: string
  full_name: string
  email: string | null
}

type ActorRow = {
  id: string
  full_name: string | null
  role: string | null
}

const STATUS_LABEL: Record<PenPalMessageStatus, string> = {
  submitted: 'Needs review',
  under_review: 'Needs review',
  approved: 'Approved',
  delivered: 'Delivered',
  published: 'Published',
  rejected: 'Rejected',
}

const EVENT_LABEL: Record<string, string> = {
  thread_created: 'Thread created',
  letter_submitted: 'Letter submitted',
  letter_approved: 'Letter approved',
  letter_rejected: 'Letter rejected',
  letter_delivered: 'Letter delivered',
  reply_published: 'Reply published',
  staff_note: 'Staff note',
  thread_closed: 'Thread closed',
}

function shortDateTime(iso: string | null): string {
  if (!iso) return 'Not recorded'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

function childName(child: ChildRow | null): string {
  if (!child) return 'Unknown child'
  return [child.first_name, child.last_name].filter(Boolean).join(' ') || child.display_name
}

function childInitials(child: ChildRow | null): string {
  if (!child) return '?'
  const parts = [child.first_name, child.last_name].filter(Boolean)
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
  return (child.first_name?.slice(0, 2) || child.display_name?.slice(0, 2) || '?').toUpperCase()
}

function messageMeta(message: MessageRow): string {
  if (message.status === 'published') return `Published ${shortDateTime(message.published_at ?? message.created_at)}`
  if (message.status === 'delivered') return `Delivered ${shortDateTime(message.delivered_at ?? message.created_at)}`
  if (message.reviewed_at) return `Reviewed ${shortDateTime(message.reviewed_at)}`
  return `Submitted ${shortDateTime(message.created_at)}`
}

function messageBody(message: MessageRow): string {
  return message.approved_body || message.raw_body
}

function eventIcon(eventType: string): LucideIcon {
  if (eventType === 'letter_rejected' || eventType === 'thread_closed') return XCircleIcon
  if (eventType === 'staff_note') return StickyNoteIcon
  if (eventType === 'reply_published') return MessageSquareReplyIcon
  if (eventType.includes('approved') || eventType.includes('delivered')) return CheckCircle2Icon
  return Clock3Icon
}

function actorName(actorId: string | null, actors: Map<string, ActorRow>): string {
  if (!actorId) return 'System'
  const actor = actors.get(actorId)
  return actor?.full_name || actor?.role || 'Staff member'
}

export default async function PenPalThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>
}) {
  const { threadId } = await params
  const { profile } = await requireAuth()
  if (!isAdminRole(profile.role) && !isStaffRole(profile.role)) {
    redirect('/dashboard')
  }

  const admin = createAdminClient()
  const { data: threadData } = await admin
    .from('pen_pal_threads')
    .select('id, sponsorship_id, sponsor_id, child_id, status, closed_reason, last_message_at, created_at')
    .eq('id', threadId)
    .maybeSingle()

  const thread = threadData as ThreadRow | null
  if (!thread) notFound()

  const [childResult, sponsorResult, messagesResult, eventsResult] = await Promise.all([
    admin
      .from('children')
      .select('id, id_rolf, display_name, first_name, last_name, country, profile_photo')
      .eq('id', thread.child_id)
      .maybeSingle(),
    admin
      .from('sponsors')
      .select('id, full_name, email')
      .eq('id', thread.sponsor_id)
      .maybeSingle(),
    admin
      .from('pen_pal_messages')
      .select('id, thread_id, direction, status, raw_body, approved_body, reviewed_at, delivered_at, published_at, rejection_reason, created_at')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true }),
    admin
      .from('pen_pal_events')
      .select('id, thread_id, message_id, actor_profile_id, event_type, notes, created_at')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true }),
  ])

  const child = childResult.data as ChildRow | null
  const sponsor = sponsorResult.data as SponsorRow | null
  const messages = (messagesResult.data ?? []) as MessageRow[]
  const events = (eventsResult.data ?? []) as EventRow[]

  if (isStaffRole(profile.role)) {
    const allowed = profile.country ?? []
    if (!child?.country || !allowed.includes(child.country)) {
      notFound()
    }
  }

  const actorIds = [...new Set(events.map((event) => event.actor_profile_id).filter((id): id is string => Boolean(id)))]
  const { data: actorRows } = actorIds.length
    ? await admin.from('profiles').select('id, full_name, role').in('id', actorIds)
    : { data: [] }
  const actors = new Map(((actorRows ?? []) as ActorRow[]).map((actor) => [actor.id, actor]))

  const name = childName(child)
  const photoSrc = child ? resolvePhotoSrc(child.profile_photo, 160) : null
  const isClosed = thread.status === 'closed'
  const latestMessage = messages.at(-1) ?? null

  return (
    <main className="google-sans-registry min-h-[calc(100svh-4rem)] bg-ice pb-12">
      <section className="border-b border-stone bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
          <Link
            href="/dashboard/letters"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-navy/55 transition-colors hover:text-navy"
          >
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            Back to Messages
          </Link>

          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              {photoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoSrc}
                  alt={name}
                  referrerPolicy="no-referrer"
                  className="size-16 rounded-2xl object-cover ring-2 ring-sky/70"
                />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-2xl bg-teal/12 text-lg font-bold text-teal ring-2 ring-sky/50">
                  {childInitials(child)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-teal">Pen Pal Thread</p>
                <h1 className="mt-2 truncate text-3xl font-bold tracking-tight text-navy sm:text-4xl">
                  {sponsor?.full_name ?? 'Unknown donor'} <span className="text-navy/35">/</span> {name}
                </h1>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-navy/55">
                  {child?.id_rolf && <span className="font-bold uppercase tracking-wide text-teal">{child.id_rolf}</span>}
                  {child?.country && (
                    <span className="inline-flex items-center gap-1">
                      <MapPinIcon className="size-4" aria-hidden="true" />
                      {child.country}
                    </span>
                  )}
                  <span>{sponsor?.email ?? 'No donor email'}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
                isClosed
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-teal/30 bg-teal/10 text-teal'
              }`}>
                {isClosed ? <LockIcon className="size-4" aria-hidden="true" /> : <ShieldCheckIcon className="size-4" aria-hidden="true" />}
                {isClosed ? 'Closed thread' : 'Active thread'}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-stone bg-ice px-3 py-1.5 text-xs font-bold text-navy/60">
                <CalendarDaysIcon className="size-4" aria-hidden="true" />
                Last message: {shortDateTime(thread.last_message_at ?? thread.created_at)}
              </span>
            </div>
          </div>

          {thread.closed_reason && (
            <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700">
              Closed reason: {thread.closed_reason}
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:px-8">
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-teal">
              Full Message Thread
            </h2>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-navy/55 ring-1 ring-stone">
              {messages.length} {messages.length === 1 ? 'message' : 'messages'}
            </span>
          </div>

          <div className="rounded-3xl border border-stone bg-white p-4 shadow-sm sm:p-5">
            {messages.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <MailIcon className="mx-auto size-8 text-teal" aria-hidden="true" />
                <p className="mt-3 text-base font-bold text-navy">No messages yet</p>
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((message) => {
                  const fromDonor = message.direction === 'donor_to_child'
                  const bubbleTone = fromDonor
                    ? 'border-amber-100 bg-amber-50/70'
                    : 'border-teal/20 bg-teal/5'
                  return (
                    <article
                      key={message.id}
                      className={`flex gap-3 ${fromDonor ? 'justify-start' : 'justify-end'}`}
                    >
                      {fromDonor && (
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                          D
                        </span>
                      )}
                      <div className={`max-w-[44rem] rounded-3xl border px-4 py-3 shadow-sm ${bubbleTone}`}>
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold text-navy/55">
                          <span className="text-navy">
                            {fromDonor ? sponsor?.full_name ?? 'Donor' : name}
                          </span>
                          <span>{messageMeta(message)}</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[11px] text-navy/55">
                            {fromDonor ? <MailIcon className="size-3" aria-hidden="true" /> : <MessageSquareReplyIcon className="size-3" aria-hidden="true" />}
                            {STATUS_LABEL[message.status]}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-7 text-navy">
                          {messageBody(message)}
                        </p>
                        {message.status === 'rejected' && message.rejection_reason && (
                          <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-700">
                            Rejection reason: {message.rejection_reason}
                          </p>
                        )}
                      </div>
                      {!fromDonor && (
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal/12 text-xs font-bold text-teal">
                          {childInitials(child)}
                        </span>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </div>

          <ThreadActionPanel
            threadId={thread.id}
            latestMessage={latestMessage}
            threadClosed={isClosed}
            isAdmin={isAdminRole(profile.role)}
            childName={name}
          />
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-stone bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-teal">Internal Activity</h2>
            {events.length === 0 ? (
              <p className="mt-4 text-sm font-semibold text-navy/45">No activity recorded yet.</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {events.map((event) => {
                  const Icon = eventIcon(event.event_type)
                  return (
                    <li key={event.id} className="flex gap-3">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-sky/45 text-teal">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-navy">
                          {EVENT_LABEL[event.event_type] ?? event.event_type}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-navy/50">
                          <UserIcon className="size-3" aria-hidden="true" />
                          {actorName(event.actor_profile_id, actors)}
                          <span aria-hidden="true">/</span>
                          {shortDateTime(event.created_at)}
                        </p>
                        {event.notes && (
                          <p className="mt-2 rounded-xl border border-stone bg-ice px-3 py-2 text-xs font-semibold leading-5 text-navy/65">
                            {event.notes}
                          </p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </main>
  )
}
