import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  CheckCircle2Icon,
  Clock3Icon,
  ExternalLinkIcon,
  InboxIcon,
  MailCheckIcon,
  MailOpenIcon,
  MapPinIcon,
  MessageSquareReplyIcon,
  SearchIcon,
  SendIcon,
  ShieldCheckIcon,
  XCircleIcon,
  type LucideIcon,
} from 'lucide-react'
import { requireAuth } from '@/lib/auth'
import { isAdminRole, isStaffRole } from '@/lib/profiles'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePhotoSrc } from '@/lib/childMedia'
import { RegistryHeader } from '@/app/dashboard/children/components/registry-page-layout'
import type { PenPalDirection, PenPalMessageStatus } from '@/lib/types'
import { getMessages, getUserLocale } from '@/i18n/server'
import type { Locale } from '@/i18n/config'
import type { MessageKey, Messages } from '@/i18n/locales/en'

type TabKey = 'needs_action' | 'all_open' | 'sent' | 'rejected'

const TABS: Array<{ key: TabKey; labelKey: MessageKey; icon: LucideIcon }> = [
  { key: 'needs_action', labelKey: 'messages.tabs.needsAction', icon: InboxIcon },
  { key: 'all_open', labelKey: 'messages.tabs.allOpen', icon: MailOpenIcon },
  { key: 'sent', labelKey: 'messages.tabs.sent', icon: CheckCircle2Icon },
  { key: 'rejected', labelKey: 'messages.tabs.rejected', icon: XCircleIcon },
] as const

type MessageRow = {
  id: string
  thread_id: string
  direction: PenPalDirection
  status: PenPalMessageStatus
  raw_body: string
  approved_body: string | null
  rejection_reason: string | null
  created_at: string
  thread: {
    id: string
    status: string
    child_id: string
    sponsor_id: string
  } | null
}

type ThreadGroup = {
  thread: NonNullable<MessageRow['thread']>
  messages: MessageRow[]
}

type ThreadSummary = ThreadGroup & {
  latest: MessageRow
  child: {
    id: string
    id_rolf: string | null
    display_name: string
    first_name: string | null
    last_name: string | null
    country: string | null
    profile_photo: string | null
  } | undefined
  sponsor: {
    id: string
    full_name: string | null
    email: string | null
  } | undefined
  childName: string
  photoSrc: string | null
}

function conversationNeedsAction(conversation: ThreadSummary): boolean {
  const latest = conversation.latest
  if (conversation.thread.status !== 'active') return false
  return (
    latest.direction === 'donor_to_child'
    && ['submitted', 'under_review', 'approved', 'delivered'].includes(latest.status)
  )
}

function conversationMatchesTab(conversation: ThreadSummary, tab: TabKey): boolean {
  const latest = conversation.latest

  if (tab === 'needs_action') return conversationNeedsAction(conversation)
  if (tab === 'all_open') return conversation.thread.status === 'active'
  if (tab === 'sent') return conversation.thread.status === 'active' && latest.direction === 'child_to_donor'
  return conversation.thread.status !== 'active' || latest.status === 'rejected'
}

function translate(messages: Messages, key: MessageKey): string {
  return messages[key]
}

function nextStepFor(message: MessageRow, threadStatus: string, messages: Messages): {
  label: string
  detail: string
  icon: LucideIcon
  className: string
} {
  if (threadStatus !== 'active') {
    return {
      label: translate(messages, 'messages.next.threadClosed'),
      detail: translate(messages, 'messages.next.threadClosedDetail'),
      icon: XCircleIcon,
      className: 'border-stone bg-stone/70 text-navy/55',
    }
  }

  if (message.direction === 'child_to_donor') {
    return {
      label: translate(messages, 'messages.next.sentToDonor'),
      detail: translate(messages, 'messages.next.sentToDonorDetail'),
      icon: MessageSquareReplyIcon,
      className: 'border-teal/25 bg-teal/5 text-teal',
    }
  }

  if (message.status === 'submitted' || message.status === 'under_review') {
    return {
      label: translate(messages, 'messages.next.reviewLetter'),
      detail: translate(messages, 'messages.next.reviewLetterDetail'),
      icon: InboxIcon,
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    }
  }

  if (message.status === 'approved') {
    return {
      label: translate(messages, 'messages.next.deliverToChild'),
      detail: translate(messages, 'messages.next.deliverToChildDetail'),
      icon: CheckCircle2Icon,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    }
  }

  if (message.status === 'delivered') {
    return {
      label: translate(messages, 'messages.next.writeChildReply'),
      detail: translate(messages, 'messages.next.writeChildReplyDetail'),
      icon: MailCheckIcon,
      className: 'border-teal/25 bg-teal/5 text-teal',
    }
  }

  return {
    label: translate(messages, 'messages.next.notShared'),
    detail: translate(messages, 'messages.next.notSharedDetail'),
    icon: XCircleIcon,
    className: 'border-red-100 bg-red-50 text-red-700',
  }
}

function previewFor(message: MessageRow): string {
  const text = (message.approved_body ?? message.raw_body).replace(/\s+/g, ' ').trim()
  if (text.length <= 180) return text
  return `${text.slice(0, 177)}...`
}

function normalizeSearch(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function matchesChildSearch(conversation: ThreadSummary, searchQuery: string): boolean {
  if (!searchQuery) return true

  const child = conversation.child
  const searchable = [
    conversation.childName,
    child?.display_name,
    child?.first_name,
    child?.last_name,
    child?.id_rolf,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return searchable.includes(searchQuery)
}

function statusLabel(status: PenPalMessageStatus, messages: Messages): string {
  return translate(messages, `messages.status.${status}` as MessageKey)
}

function timeValue(iso: string | null | undefined): number {
  if (!iso) return 0
  const value = new Date(iso).getTime()
  return Number.isFinite(value) ? value : 0
}

function shortDate(iso: string | null | undefined, locale: Locale, messages: Messages): string {
  const value = timeValue(iso)
  if (!value) return translate(messages, 'messages.card.unknownDate')

  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function childInitials(child: {
  first_name: string | null
  last_name: string | null
  display_name: string
} | undefined): string {
  if (!child) return '?'
  const parts = [child.first_name, child.last_name].filter(Boolean)
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
  return (child.first_name?.slice(0, 2) || child.display_name?.slice(0, 2) || '?').toUpperCase()
}

export default async function PenPalReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; search?: string }>
}) {
  const { user, profile } = await requireAuth()
  if (!isAdminRole(profile.role) && !isStaffRole(profile.role)) {
    redirect('/dashboard')
  }
  const isAdmin = isAdminRole(profile.role)
  const locale = await getUserLocale(user.id)
  const i18nMessages = getMessages(locale)
  const t = (key: MessageKey) => translate(i18nMessages, key)

  const { tab: rawTab, search: rawSearch } = await searchParams
  const activeTab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : 'needs_action'
  const searchValue = (rawSearch ?? '').trim()
  const searchQuery = normalizeSearch(searchValue)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pen_pal_messages')
    .select(`
      id, thread_id, direction, status, raw_body, approved_body, rejection_reason, created_at,
      thread:pen_pal_threads(id, status, child_id, sponsor_id)
    `)
    .order('created_at', { ascending: false })

  let messages = ((data ?? []) as unknown as MessageRow[]).filter((m) => m.thread !== null)

  // Resolve children + sponsors for display and for staff country scoping.
  const childIds = [...new Set(messages.map((m) => m.thread!.child_id))]
  const sponsorIds = [...new Set(messages.map((m) => m.thread!.sponsor_id))]

  const [{ data: children }, { data: sponsors }] = await Promise.all([
    childIds.length
      ? admin
          .from('children')
          .select('id, id_rolf, display_name, first_name, last_name, country, profile_photo')
          .in('id', childIds)
      : Promise.resolve({ data: [] as never[] }),
    sponsorIds.length
      ? admin.from('sponsors').select('id, full_name, email').in('id', sponsorIds)
      : Promise.resolve({ data: [] as never[] }),
  ])

  const childById = new Map((children ?? []).map((c) => [c.id, c]))
  const sponsorById = new Map((sponsors ?? []).map((s) => [s.id, s]))

  // Staff see only letters for children in their assigned countries.
  if (isStaffRole(profile.role)) {
    const allowed = new Set(profile.country ?? [])
    messages = messages.filter((m) => {
      const child = childById.get(m.thread!.child_id)
      return child?.country ? allowed.has(child.country) : false
    })
  }

  const threadGroups = new Map<string, ThreadGroup>()
  for (const message of messages) {
    const thread = message.thread
    if (!thread) continue
    const existing = threadGroups.get(thread.id)
    if (existing) {
      existing.messages.push(message)
    } else {
      threadGroups.set(thread.id, { thread, messages: [message] })
    }
  }

  const conversations: ThreadSummary[] = []
  for (const group of threadGroups.values()) {
    group.messages.sort((a, b) => timeValue(b.created_at) - timeValue(a.created_at))
    const latest = group.messages[0]
    if (!latest) continue

    const child = childById.get(group.thread.child_id)
    const sponsor = sponsorById.get(group.thread.sponsor_id)
    const childName = child
        ? [child.first_name, child.last_name].filter(Boolean).join(' ') || child.display_name
        : t('messages.card.unknownChild')

    conversations.push({
      ...group,
      latest,
      child,
      sponsor,
      childName,
      photoSrc: child ? resolvePhotoSrc(child.profile_photo, 120) : null,
    })
  }
  conversations.sort((a, b) => timeValue(b.latest.created_at) - timeValue(a.latest.created_at))

  const searchedConversations = conversations.filter((conversation) => matchesChildSearch(conversation, searchQuery))

  const counts = new Map<TabKey, number>()
  for (const tab of TABS) {
    counts.set(tab.key, searchedConversations.filter((conversation) => conversationMatchesTab(conversation, tab.key)).length)
  }
  const visible = searchedConversations.filter((conversation) => conversationMatchesTab(conversation, activeTab))
  const totalConversations = searchedConversations.length
  const needsAction = counts.get('needs_action') ?? 0
  const openChats = counts.get('all_open') ?? 0

  return (
    <main className="google-sans-registry min-h-[calc(100svh-4rem)] bg-ice pb-12">
      <RegistryHeader
        badge={isAdmin ? t('messages.header.adminBadge') : t('messages.header.staffBadge')}
        eyebrow={isAdmin ? t('messages.header.allRegions') : (profile.country?.join(', ') ?? '')}
        title={t('messages.header.title')}
        subtitle={t('messages.header.subtitle')}
      />

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-stone bg-white px-4 py-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-wide text-navy/50">{t('messages.stats.conversations')}</p>
              <span className="flex size-9 items-center justify-center rounded-xl bg-stone/60 text-navy/65">
                <MailOpenIcon className="size-4" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-2 text-3xl font-bold tracking-tight text-navy">{totalConversations.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700">{t('messages.stats.needsAction')}</p>
              <span className="flex size-9 items-center justify-center rounded-xl bg-white/70 text-amber-700">
                <Clock3Icon className="size-4" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-2 text-3xl font-bold tracking-tight text-amber-700">{needsAction.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl border border-teal/25 bg-teal/5 px-4 py-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-wide text-teal">{t('messages.stats.openChats')}</p>
              <span className="flex size-9 items-center justify-center rounded-xl bg-white/75 text-teal">
                <MessageSquareReplyIcon className="size-4" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-2 text-3xl font-bold tracking-tight text-teal">{openChats.toLocaleString()}</p>
          </div>
        </section>

        <form action="/dashboard/letters" className="rounded-2xl border border-stone bg-white p-3 shadow-sm">
          <input type="hidden" name="tab" value={activeTab} />
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">{t('messages.search.label')}</span>
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-navy/35" aria-hidden="true" />
              <input
                type="search"
                name="search"
                defaultValue={searchValue}
                placeholder={t('messages.search.placeholder')}
                className="min-h-12 w-full rounded-xl border border-stone bg-ice pl-11 pr-4 text-sm font-semibold text-navy outline-none transition-colors placeholder:text-navy/35 focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/15"
              />
            </label>
            <button
              type="submit"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            >
              <SearchIcon className="size-4" aria-hidden="true" />
              {t('messages.search.submit')}
            </button>
            {searchQuery && (
              <Link
                href={`/dashboard/letters?tab=${activeTab}`}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-stone px-4 text-sm font-bold text-navy/60 transition-colors hover:border-teal/30 hover:text-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              >
                {t('messages.search.clear')}
              </Link>
            )}
          </div>
        </form>

        <nav className="rounded-2xl border border-stone bg-white p-2 shadow-sm" aria-label={t('messages.nav.label')}>
          <div className="grid gap-2 sm:grid-cols-4">
            {TABS.map((tab) => (
              <Link
                key={tab.key}
                href={searchQuery
                  ? `/dashboard/letters?tab=${tab.key}&search=${encodeURIComponent(searchValue)}`
                  : `/dashboard/letters?tab=${tab.key}`}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition-colors ${
                  activeTab === tab.key
                    ? 'bg-navy text-white shadow-sm'
                    : 'text-navy/55 hover:bg-sky/25 hover:text-navy'
                }`}
              >
                <tab.icon className="size-4 shrink-0" aria-hidden="true" />
                {t(tab.labelKey)}
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${activeTab === tab.key ? 'bg-white/20' : 'bg-stone/70'}`}>
                  {counts.get(tab.key) ?? 0}
                </span>
              </Link>
            ))}
          </div>
        </nav>

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-semibold leading-6 text-red-700">
            <XCircleIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p>{error.message}</p>
          </div>
        )}

        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-stone bg-white px-6 py-14 text-center shadow-sm">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-sky text-teal">
              <MailOpenIcon className="size-7" aria-hidden="true" />
            </div>
            <p className="text-lg font-bold text-navy">
              {searchQuery ? t('messages.empty.search') : t('messages.empty.queue')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((conversation) => {
              const latest = conversation.latest
              const donorName = conversation.sponsor?.full_name ?? t('messages.card.unknownDonor')
              const DirectionIcon = latest.direction === 'donor_to_child' ? SendIcon : MessageSquareReplyIcon
              const directionLabel = latest.direction === 'donor_to_child'
                ? t('messages.card.donorLetter')
                : t('messages.card.childReply')
              const routeLabel = latest.direction === 'donor_to_child'
                ? `${donorName} -> ${conversation.childName}`
                : `${conversation.childName} -> ${donorName}`
              const nextStep = nextStepFor(latest, conversation.thread.status, i18nMessages)
              const StepIcon = nextStep.icon
              const bubbleClass = latest.direction === 'donor_to_child'
                ? 'border-amber-200 bg-amber-50/80'
                : 'border-teal/25 bg-teal/5'

              return (
                <article key={conversation.thread.id} className="rounded-2xl border border-stone bg-white p-4 shadow-sm transition-colors hover:border-teal/30 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="flex min-w-0 flex-1 gap-3">
                      {conversation.photoSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={conversation.photoSrc}
                          alt={conversation.childName}
                          referrerPolicy="no-referrer"
                          className="size-12 rounded-xl object-cover ring-2 ring-sky/70"
                        />
                      ) : (
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-teal/12 text-sm font-bold text-teal ring-2 ring-sky/50">
                          {childInitials(conversation.child)}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                          <h2 className="min-w-0 flex-1 basis-full break-words text-base font-bold leading-6 text-navy sm:basis-auto">
                            {routeLabel}
                          </h2>
                          <span className="inline-flex items-center gap-1 rounded-full border border-sky/70 bg-sky/25 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-navy/55">
                            <ShieldCheckIcon className="size-3" aria-hidden="true" />
                            {t('messages.card.staffMediated')}
                          </span>
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-navy/55">
                          {conversation.child?.id_rolf && (
                            <span className="font-bold uppercase tracking-wide text-teal">{conversation.child.id_rolf}</span>
                          )}
                          {conversation.child?.country && (
                            <span className="flex items-center gap-1">
                              <MapPinIcon className="size-3" aria-hidden="true" />
                              {conversation.child.country}
                            </span>
                          )}
                          <span>
                            {conversation.messages.length.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')}{' '}
                            {conversation.messages.length === 1
                              ? t('messages.card.messageSingular')
                              : t('messages.card.messagePlural')}
                          </span>
                          <span>{t('messages.card.latest')} {shortDate(latest.created_at, locale, i18nMessages)}</span>
                        </p>

                        <div className={`mt-3 rounded-2xl border px-3 py-3 ${bubbleClass}`}>
                          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-navy/55">
                            <span className="inline-flex items-center gap-1.5 text-navy">
                              <DirectionIcon className="size-3.5" aria-hidden="true" />
                              {directionLabel}
                            </span>
                            <span>{statusLabel(latest.status, i18nMessages)}</span>
                          </div>
                          <p className="mt-2 text-sm font-semibold leading-6 text-navy/75">{previewFor(latest)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex w-full flex-col gap-3 lg:w-56 lg:items-end">
                      <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${nextStep.className}`}>
                        <StepIcon className="size-3.5" aria-hidden="true" />
                        {nextStep.label}
                      </span>
                      <p className="text-sm font-semibold leading-6 text-navy/60 lg:text-right">{nextStep.detail}</p>
                      <Link
                        href={`/dashboard/letters/${conversation.thread.id}`}
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal lg:w-auto"
                      >
                        {t('messages.card.openChat')}
                        <ExternalLinkIcon className="size-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
