import { Suspense } from 'react'
import Link from 'next/link'
import {
  BookOpen,
  Clock3,
  Globe2,
  Heart,
  Home,
  MapPin,
  Play,
  Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Child, ChildUpdate, Sponsorship } from '@/lib/types'
import { calculateAge } from '@/components/actions'
import { resolvePhotoSrc, resolveVideo } from '@/lib/childMedia'

type IconComponent = typeof MapPin

type DonorSponsorshipRow = Pick<
  Sponsorship,
  'id' | 'child_id' | 'status' | 'start_date' | 'end_date' | 'amount' | 'frequency'
> & {
  child: Child | Child[] | null
}

type DonorChildProfile = {
  child: Child
  sponsorshipStart: string | null
  sponsorshipEnd: string | null
  amount: number | null
  frequency: Sponsorship['frequency']
}

type DonorChildUpdate = Pick<ChildUpdate, 'child_id' | 'title' | 'body' | 'created_at'>

const fullMonthDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const monthYearFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
})

const cardAccents = [
  {
    border: 'border-teal/80',
    bg: 'bg-teal/85',
    soft: 'bg-sky/55',
    text: 'text-teal',
    button: 'bg-teal hover:bg-teal/90',
  },
  {
    border: 'border-[#d99068]/80',
    bg: 'bg-[#d99068]',
    soft: 'bg-[#f4dfd2]',
    text: 'text-[#c4754d]',
    button: 'bg-[#c4754d] hover:bg-[#b46845]',
  },
  {
    border: 'border-navy/70',
    bg: 'bg-navy',
    soft: 'bg-navy/10',
    text: 'text-navy',
    button: 'bg-navy hover:bg-navy/90',
  },
]

function safeDate(value: string | null): Date | null {
  if (!value) return null

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T12:00:00`
    : value
  const date = new Date(normalized)

  return Number.isNaN(date.getTime()) ? null : date
}

function fullDateLabel(value: string | null): string | null {
  const date = safeDate(value)
  return date ? fullMonthDateFormatter.format(date) : null
}

function shortDateLabel(value: string | null): string | null {
  const date = safeDate(value)
  return date ? shortDateFormatter.format(date) : null
}

function joinedLabel(child: Child): string {
  const joinedDate = fullDateLabel(child.date_joined)
  if (joinedDate) return joinedDate
  if (child.year_joined) return String(child.year_joined)
  return 'Unknown'
}

function birthdateLabel(child: Child): string | null {
  if (!child.birth_year || !child.birth_month || !child.birth_day) return null
  return fullMonthDateFormatter.format(
    new Date(child.birth_year, child.birth_month - 1, child.birth_day),
  )
}

function childName(child: Child): string {
  return (
    [child.first_name, child.last_name].filter(Boolean).join(' ') ||
    child.display_name ||
    'Unnamed'
  )
}

function childFirstName(child: Child, fallback: string): string {
  return child.first_name || child.display_name || fallback
}

function initialsFor(child: Child): string {
  const parts = [child.first_name, child.last_name].filter(Boolean)
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
  return (child.first_name?.slice(0, 2) || child.display_name?.slice(0, 2) || '?').toUpperCase()
}

function hobbiesFor(child: Child): string[] {
  return (child.hobby ?? '')
    .split(',')
    .map((hobby) => hobby.trim())
    .filter(Boolean)
}

function sentenceList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`
}

function yearsInHome(child: Child): number | null {
  const joined = safeDate(child.date_joined)
  const year = joined?.getFullYear() ?? child.year_joined
  if (!year) return null

  const years = new Date().getFullYear() - year
  return years >= 0 ? years : null
}

function monthsSince(value: string | null): number | null {
  const start = safeDate(value)
  if (!start) return null

  const now = new Date()
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth()

  if (now.getDate() < start.getDate()) months -= 1
  return months >= 0 ? months : null
}

function connectionLabel(startDate: string | null): string | null {
  const months = monthsSince(startDate)
  if (months === null) return null
  if (months === 0) return 'New this month'

  const years = Math.floor(months / 12)
  const remainingMonths = months % 12

  if (years === 0) return `${remainingMonths} mo`
  if (remainingMonths === 0) return `${years} yr${years === 1 ? '' : 's'}`
  return `${years} yr${years === 1 ? '' : 's'} ${remainingMonths} mo`
}

function ageLine(child: Child): string {
  const age = calculateAge(child.birth_year, child.birth_month, child.birth_day)
  const birthdate = birthdateLabel(child)

  if (age && birthdate) return `${age} years old - Born ${birthdate}`
  if (age) return `${age} years old`
  if (birthdate) return `Born ${birthdate}`
  return 'Profile details being prepared'
}

function storyFor(child: Child): string[] {
  const name = childName(child)
  const firstName = childFirstName(child, name)
  const age = calculateAge(child.birth_year, child.birth_month, child.birth_day)
  const joined = child.year_joined
    ? ` in ${child.year_joined}`
    : child.date_joined
      ? ` in ${monthYearFormatter.format(safeDate(child.date_joined) ?? new Date())}`
      : ''
  const location = child.country ? ` in ${child.country}` : ''
  const hobbies = hobbiesFor(child)
  const details = [
    child.favorite_subject ? `My favorite subject is ${child.favorite_subject}.` : null,
    hobbies.length > 0 ? ` ${sentenceList(hobbies)}.` : null,
    child.career_aspiration ? `When I grow up, I hope to be ${child.career_aspiration}.` : null,
  ].filter((item): item is string => Boolean(item))

  return [
    `My name is ${name}. I joined the Children's Home${location}${joined}.${age ? ` I am ${age} years old this year.` : ''}`,
    child.bio?.trim() || details.join(' ') || `The ROLF team is preparing more of ${firstName}'s story.`,
    'Thank you for sponsoring me and loving me. I pray that God will bless you too!',
  ]
}

function latestUpdateFor(child: Child, update: DonorChildUpdate | undefined): {
  body: string
  date: string | null
} {
  if (update) {
    return {
      body: update.body || update.title,
      date: shortDateLabel(update.created_at),
    }
  }

  const firstName = childFirstName(child, childName(child))
  return {
    body: `${firstName}'s profile is ready here, and the ROLF team will add new school, home, and media updates as they are prepared for sponsors.`,
    date: shortDateLabel(child.updated_at),
  }
}

function relationChild(child: DonorSponsorshipRow['child']): Child | null {
  if (Array.isArray(child)) return child[0] ?? null
  return child
}

function donorProfilesFromRows(rows: DonorSponsorshipRow[]): DonorChildProfile[] {
  const profilesByChildId = new Map<string, DonorChildProfile>()

  for (const row of rows) {
    const child = relationChild(row.child)
    if (!child || !row.child_id) continue

    const existing = profilesByChildId.get(child.id)
    if (!existing) {
      profilesByChildId.set(child.id, {
        child,
        sponsorshipStart: row.start_date,
        amount: row.amount,
        frequency: row.frequency,
        sponsorshipEnd: row.end_date,
      })
      continue
    }

    if (
      row.start_date &&
      (!existing.sponsorshipStart || row.start_date < existing.sponsorshipStart)
    ) {
      profilesByChildId.set(child.id, {
        child,
        sponsorshipStart: row.start_date,
        amount: row.amount,
        frequency: row.frequency,
        sponsorshipEnd: row.end_date,
      })
    }
  }

  return Array.from(profilesByChildId.values()).sort((left, right) => {
    const leftDate = left.sponsorshipStart ?? '9999-12-31'
    const rightDate = right.sponsorshipStart ?? '9999-12-31'
    return leftDate.localeCompare(rightDate)
  })
}

function StatCard({
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
    <div className="min-w-0 rounded-2xl border border-[#e8dfd2] bg-white/75 px-4 py-4 shadow-[0_10px_30px_rgba(21,44,75,0.05)] sm:px-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky/65 text-teal">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-navy/45">{label}</p>
          <p className="mt-1 truncate text-2xl font-bold leading-none text-navy">{value}</p>
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-navy/55">{helper}</p>
    </div>
  )
}

function SectionLabel({
  icon: Icon = Sparkles,
  children,
}: {
  icon?: IconComponent
  children: React.ReactNode
}) {
  return (
    <h3 className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.26em] text-teal">
      <Icon className="size-3.5" aria-hidden="true" />
      {children}
    </h3>
  )
}

function ChildPhotoPanel({
  child,
  accentIndex,
}: {
  child: Child
  accentIndex: number
}) {
  const name = childName(child)
  const photoSrc = resolvePhotoSrc(child.profile_photo, 1800)
  const accent = cardAccents[accentIndex % cardAccents.length]

  return (
    <div className="relative mx-auto w-full max-w-[18rem] shrink-0 overflow-hidden rounded-[1.75rem] border border-[#eadfd0] bg-[#f6f1e8] shadow-[0_18px_45px_rgba(21,44,75,0.10)] md:mx-0 md:w-72 lg:w-80">
      <div className="flex aspect-[3/4] w-full items-center justify-center">
        {photoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- child media can be S3 or Google Drive URLs that are resolved at runtime.
          <img
            src={photoSrc}
            alt={`${name} profile photo`}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full object-contain"
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center ${accent.bg}`}>
            <span className="text-6xl font-bold text-white sm:text-8xl">
              {initialsFor(child)}
            </span>
          </div>
        )}
      </div>
      <span className="absolute left-4 top-4 rounded-full bg-teal px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-sm">
        New
      </span>
    </div>
  )
}

const FREQUENCY_LABELS: Record<NonNullable<Sponsorship['frequency']>, string> = {
  one_time: 'One-time',
  weekly: '/week',
  biweekly: '/biweekly',
  monthly: '/month',
  quarterly: '/quarter',
  semiannual: '/6 months',
  annual: '/year',
}


function formatContribution(
  amount: number | null,
  frequency: Sponsorship['frequency'],
): string {
  if (!amount) return 'On file'
  const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
  if (!frequency || frequency === 'one_time') return usd
  return `${usd}${FREQUENCY_LABELS[frequency]}`
}

function DetailStrip({
  child,
  sponsorshipStart,
  sponsorshipEnd,
  amount,
  frequency,
}: {
  child: Child
  sponsorshipStart: string | null
  sponsorshipEnd: string | null
  amount: number | null
  frequency: Sponsorship['frequency']
}) {
  const hobbies = hobbiesFor(child)
  const items = [
    {
      label: 'Favorite subject',
      value: child.favorite_subject || 'To be added',
    },
    {
      label: 'Hobbies',
      value: hobbies.length > 0 ? sentenceList(hobbies) : 'To be added',
    },
    {
      label: 'Date joined',
      value: joinedLabel(child),
    },
    {
      label: 'Sponsorship since',
      value: sponsorshipStart ? shortDateLabel(sponsorshipStart) ?? 'Active' : 'Active',
    },
    {
      label: 'Contribution',
      value: formatContribution(amount, frequency),
    },
    {
      label: 'End date',
      value: sponsorshipEnd ? shortDateLabel(sponsorshipEnd) ?? 'Ongoing' : 'Ongoing',
    },
  ]

  return (
    <dl className="mt-5 grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="min-w-0 rounded-2xl border border-[#e7ded0] bg-[#f6f1e8] px-3 py-3"
        >
          <dt className="text-[0.7rem] font-bold uppercase tracking-wide text-navy/45">
            {item.label}
          </dt>
          <dd className="mt-1 text-sm font-bold leading-snug text-[#241b16] sm:text-base">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function VideoPanel({ child, accentIndex }: { child: Child; accentIndex: number }) {
  const name = childName(child)
  const firstName = childFirstName(child, name)
  const video = resolveVideo(child.profile_video)
  const accent = cardAccents[accentIndex % cardAccents.length]

  if (video.kind === 'none') return null

  return (
    <section className="overflow-hidden rounded-3xl border border-teal/10 bg-sky/65 shadow-inner">
      <div className="relative flex aspect-video min-h-56 items-center justify-center overflow-hidden bg-gradient-to-br from-sky via-sky/75 to-white/80">
        <span className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-teal shadow-sm">
          <span className="size-2 rounded-full bg-teal" aria-hidden="true" />
          Video
        </span>
        {video.kind === 'drive' ? (
          <iframe
            src={video.src}
            allow="autoplay"
            allowFullScreen
            title={`A message from ${firstName}`}
            className="h-full w-full"
          />
        ) : (
          <video
            src={video.src}
            controls
            preload="metadata"
            className="h-full w-full"
          />
        )}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex size-20 items-center justify-center rounded-full bg-teal/20 text-white">
            <span className={`flex size-14 items-center justify-center rounded-full ${accent.bg}`}>
              <Play className="ml-1 size-6 fill-current" aria-hidden="true" />
            </span>
          </span>
        </span>
      </div>
      <div className="bg-sky/45 px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal">
            Video message
          </p>
          <p className="mt-1 text-base font-bold text-[#241b16]">
            A message from {firstName}
          </p>
        </div>
      </div>
    </section>
  )
}

function FeaturedChildCard({
  profile,
  update,
  index,
}: {
  profile: DonorChildProfile
  update: DonorChildUpdate | undefined
  index: number
}) {
  const { child, sponsorshipStart, sponsorshipEnd, amount, frequency } = profile
  const name = childName(child)
  const story = storyFor(child)
  const latest = latestUpdateFor(child, update)
  const accent = cardAccents[index % cardAccents.length]
  const years = yearsInHome(child)

  return (
    <article
      className={`overflow-hidden rounded-[2rem] border border-[#eadfd0] border-t-8 ${accent.border} bg-[#fffdf8] shadow-[0_24px_60px_rgba(21,44,75,0.10)] motion-safe:duration-200 motion-safe:ease-out motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2`}
    >
      <div className="space-y-8 p-5 sm:p-8 lg:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <ChildPhotoPanel child={child} accentIndex={index} />

          <div className="min-w-0 flex-1 md:pt-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-teal">
              {child.country && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {child.country}
                </span>
              )}
              {years !== null && (
                <span className="inline-flex items-center gap-1.5 text-navy/40">
                  <Home className="size-3.5" aria-hidden="true" />
                  {years === 0 ? 'Joined this year' : `${years} year${years === 1 ? '' : 's'} at ROLF`}
                </span>
              )}
            </div>
            <h2 className="mt-3 font-serif text-4xl font-bold leading-tight tracking-tight text-[#241b16] sm:text-5xl">
              {name}
            </h2>
            <p className="mt-3 text-base font-semibold leading-7 text-[#7a6d5d]">
              {ageLine(child)}
            </p>
            <DetailStrip
              child={child}
              sponsorshipStart={sponsorshipStart}
              sponsorshipEnd={sponsorshipEnd}
              amount={amount}
              frequency={frequency}
            />
          </div>
        </div>

        <section className="space-y-3">
          <SectionLabel>My story</SectionLabel>
          <div className="space-y-3 font-serif text-xl leading-9 text-[#2d241d] sm:text-2xl sm:leading-10">
            <p className="italic">Dearest Sponsor,</p>
            {story.map((paragraph, paragraphIndex) => (
              <p key={paragraphIndex} className="italic">
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <SectionLabel icon={BookOpen}>Latest from the Children&apos;s Home</SectionLabel>
          <p className="text-base font-semibold leading-8 text-[#493d32] sm:text-lg">
            {latest.body}
          </p>
          {latest.date && (
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#9a8d7d]">
              <Clock3 className="size-4" aria-hidden="true" />
              Updated {latest.date}
            </p>
          )}
        </section>

        <VideoPanel child={child} accentIndex={index} />

        <Link
          href={`/dashboard/children/${child.id}`}
          className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-navy px-6 text-base font-bold text-white shadow-sm transition-colors hover:bg-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
        >
          View full profile
        </Link>
      </div>
    </article>
  )
}

function DonorCardSkeleton({ featured = false }: { featured?: boolean }) {
  return (
    <div
      className={
        featured
          ? 'overflow-hidden rounded-[2rem] border border-[#eadfd0] border-t-8 border-teal/50 bg-white/75 p-5 shadow-[0_24px_60px_rgba(21,44,75,0.08)] sm:p-8'
          : 'overflow-hidden rounded-3xl border border-[#eadfd0] border-t-4 border-navy/20 bg-white/75 p-5 shadow-sm sm:p-6'
      }
    >
      <div className="space-y-6">
        <div className="flex gap-5">
          <div className={featured ? 'size-28 animate-pulse rounded-[1.45rem] bg-stone sm:size-36' : 'size-14 animate-pulse rounded-full bg-stone sm:size-16'} />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="h-3 w-32 animate-pulse rounded bg-stone" />
            <div className="h-8 w-64 max-w-full animate-pulse rounded bg-stone/80" />
            <div className="h-4 w-56 max-w-full animate-pulse rounded bg-stone/70" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-stone/70" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-stone/70" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-stone/70" />
        </div>
        {featured && (
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="h-14 animate-pulse rounded-xl bg-stone/60" />
            <div className="h-14 animate-pulse rounded-xl bg-stone/60" />
            <div className="h-14 animate-pulse rounded-xl bg-stone/60" />
            <div className="h-14 animate-pulse rounded-xl bg-stone/60" />
          </div>
        )}
      </div>
    </div>
  )
}

function DonorSkeleton() {
  return (
    <div className="space-y-10">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="h-4 w-44 animate-pulse rounded bg-stone" />
        <div className="h-14 w-[34rem] max-w-full animate-pulse rounded bg-stone/80" />
        <div className="h-5 w-96 max-w-full animate-pulse rounded bg-stone/70" />
      </div>
      <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-3">
        <div className="h-28 animate-pulse rounded-2xl bg-white/70" />
        <div className="h-28 animate-pulse rounded-2xl bg-white/70" />
        <div className="h-28 animate-pulse rounded-2xl bg-white/70" />
      </div>
      <div className="mx-auto max-w-4xl space-y-7">
        <DonorCardSkeleton featured />
        <DonorCardSkeleton />
      </div>
    </div>
  )
}

async function DonorChildren() {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('sponsorships')
    .select(`
      id,
      child_id,
      status,
      start_date,
      amount,
      frequency,
      end_date,
      child:children(*)
    `)
    .eq('status', 'active')
    .not('child_id', 'is', null)
    .order('start_date', { ascending: true })

  const profiles = donorProfilesFromRows((data ?? []) as DonorSponsorshipRow[])
  const children = profiles.map((profile) => profile.child)
  const count = profiles.length
  const countries = Array.from(
    new Set(
      children
        .map((child) => child.country)
        .filter((country): country is string => Boolean(country)),
    ),
  )
  const longestConnection = profiles
    .map((profile) => ({
      label: connectionLabel(profile.sponsorshipStart),
      months: monthsSince(profile.sponsorshipStart),
    }))
    .filter((connection): connection is { label: string; months: number } => {
      return connection.label !== null && connection.months !== null
    })
    .sort((left, right) => right.months - left.months)[0]?.label

  let updatesByChildId = new Map<string, DonorChildUpdate>()

  if (children.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatesResult = await (supabase as any)
      .from('child_updates')
      .select('child_id, title, body, created_at')
      .eq('visible_to_donor', true)
      .in('child_id', children.map((child) => child.id))
      .order('created_at', { ascending: false })

    if (!updatesResult.error) {
      updatesByChildId = new Map()
      for (const update of (updatesResult.data ?? []) as DonorChildUpdate[]) {
        if (!updatesByChildId.has(update.child_id)) {
          updatesByChildId.set(update.child_id, update)
        }
      }
    }
  }

  return (
    <>
      <header className="mx-auto max-w-4xl">
        <p className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.34em] text-teal">
          <Sparkles className="size-4" aria-hidden="true" />
          My sponsorships
        </p>
        <h1 className="mt-5 max-w-3xl font-serif text-5xl font-bold leading-[0.98] tracking-tight text-[#241b16] sm:text-6xl lg:text-7xl">
          The children you&apos;re sponsoring
        </h1>
        <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-[#7c705f] sm:text-xl">
          Their stories, updates, and latest news in one place.
        </p>

        {count > 0 && (
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <StatCard
              icon={Heart}
              label="Active profiles"
              value={count.toLocaleString()}
              helper={`${count} child${count === 1 ? '' : 'ren'} currently linked`}
            />
            <StatCard
              icon={Globe2}
              label="Countries"
              value={countries.length.toLocaleString()}
              helper={
                countries.length === 1
                  ? countries[0]
                  : countries.length > 1
                    ? `${countries.slice(0, 2).join(', ')}${countries.length > 2 ? ' +' : ''}`
                    : 'Location details pending'
              }
            />
            <StatCard
              icon={Clock3}
              label="Longest connection"
              value={longestConnection ?? 'New'}
              helper="Based on active sponsorship dates"
            />
          </div>
        )}
      </header>

      {error && (
        <div className="mx-auto mt-8 max-w-4xl rounded-2xl border border-destructive/20 bg-white px-5 py-4 text-sm font-semibold leading-6 text-destructive shadow-sm">
          We couldn&apos;t load your sponsorship profiles right now. Please refresh, or
          contact the ROLF team if this keeps happening.
        </div>
      )}

      {!error && count === 0 && (
        <div className="mx-auto mt-10 max-w-2xl rounded-[2rem] border border-dashed border-[#d9ccbc] bg-[#fffdf8] px-6 py-14 text-center shadow-sm">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-sky text-teal">
            <Heart className="size-7" aria-hidden="true" />
          </div>
          <h2 className="mt-5 font-serif text-3xl font-bold text-[#241b16]">
            No sponsorship profiles are linked yet
          </h2>
          <p className="mx-auto mt-3 max-w-md text-base font-semibold leading-7 text-[#7c705f]">
            We couldn&apos;t find an active child sponsorship linked to your account. If
            this looks wrong, the ROLF team can connect the profile for you.
          </p>
        </div>
      )}

      {count > 0 && (
        <div className="mx-auto mt-12 max-w-4xl space-y-7">
          {profiles.map((profile, index) => (
            <FeaturedChildCard
              key={profile.child.id}
              profile={profile}
              update={updatesByChildId.get(profile.child.id)}
              index={index}
            />
          ))}
        </div>
      )}
    </>
  )
}

export function DonorView() {
  return (
    <div className="google-sans-page min-h-[calc(100svh_-_4rem)] bg-[#f8f1e8]">
      <main className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <Suspense fallback={<DonorSkeleton />}>
          <DonorChildren />
        </Suspense>
      </main>
    </div>
  )
}
