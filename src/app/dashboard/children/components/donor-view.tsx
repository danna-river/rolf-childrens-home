import { Suspense } from 'react'
import {
  BookOpen,
  CalendarDays,
  Heart,
  Home,
  MapPin,
  Video,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Child } from '@/lib/types'
import { calculateAge } from '@/components/actions'

type IconComponent = typeof MapPin

const monthYearFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
})

const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function safeDate(value: string | null): Date | null {
  if (!value) return null

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T12:00:00`
    : value
  const date = new Date(normalized)

  return Number.isNaN(date.getTime()) ? null : date
}

function joinedLabel(child: Child): string | null {
  const joinedDate = safeDate(child.date_joined)
  if (joinedDate) return monthYearFormatter.format(joinedDate)
  if (child.year_joined) return String(child.year_joined)
  return null
}

function yearsInHome(child: Child): number | null {
  const year = child.date_joined
    ? new Date(child.date_joined).getFullYear()
    : child.year_joined
  if (!year) return null
  const years = new Date().getFullYear() - year
  return years >= 0 ? years : null
}

function yearsLabel(years: number | null): string | null {
  if (years === null) return null
  if (years === 0) return 'Joined this year'
  return `${years} year${years === 1 ? '' : 's'} at ROLF`
}

function updatedLabel(child: Child): string | null {
  const updatedDate = safeDate(child.updated_at)
  if (!updatedDate) return null
  return fullDateFormatter.format(updatedDate)
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

function hobbiesFor(child: Child): string[] {
  return (child.hobby ?? '')
    .split(',')
    .map((hobby) => hobby.trim())
    .filter(Boolean)
}

function MetaItem({
  icon: Icon,
  children,
}: {
  icon: IconComponent
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-navy/65">
      <Icon className="size-3.5 shrink-0 text-teal" aria-hidden="true" />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold text-navy/50">{children}</h3>
}

function SummaryItem({
  icon: Icon,
  label,
  value,
}: {
  icon: IconComponent
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-t border-stone py-3 first:border-t-0 sm:border-l sm:border-t-0 sm:px-5 sm:first:border-l-0 sm:first:pl-0">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sky/70 text-teal">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-navy/50">{label}</p>
        <p className="truncate text-sm font-semibold text-navy">{value}</p>
      </div>
    </div>
  )
}

function ProfileFact({
  icon: Icon,
  label,
  value,
}: {
  icon: IconComponent
  label: string
  value: string
}) {
  return (
    <div className="min-w-0 border-t border-stone pt-3">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-navy/50">
        <Icon className="size-3.5 text-teal" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-semibold text-navy">{value}</dd>
    </div>
  )
}

function ChildCard({ child, index }: { child: Child; index: number }) {
  const name = childName(child)
  const firstName = childFirstName(child, name)
  const years = yearsInHome(child)
  const timeAtRolf = yearsLabel(years)
  const joined = joinedLabel(child)
  const lastUpdated = updatedLabel(child)
  const initial = child.first_name?.[0]?.toUpperCase() ?? '?'
  const hobbies = hobbiesFor(child)
  const dynamicAge = calculateAge(child.birth_year, child.birth_month, child.birth_day)

  return (
    <article
      className="grid overflow-hidden rounded-lg border border-stone bg-white shadow-[0_1px_2px_rgba(21,44,75,0.06)] motion-safe:duration-200 motion-safe:ease-out motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both sm:grid-cols-[190px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)] [animation-delay:var(--entry-delay)]"
      style={
        {
          '--entry-delay': `${Math.min(index, 5) * 55}ms`,
        } as React.CSSProperties
      }
    >
      <div className="relative min-h-56 overflow-hidden bg-sky sm:min-h-full">
        {child.profile_photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote S3 URLs without configured remotePatterns; matches existing components
          <img
            src={child.profile_photo}
            alt={`${name} profile photo`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-6xl font-semibold text-navy/25">
              {initial}
            </span>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-md border border-white/70 bg-white/90 px-2 py-1 text-xs font-semibold text-navy shadow-sm">
          Active
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-teal">Sponsorship profile</p>
            <h2 className="mt-1 text-2xl font-semibold leading-tight text-navy">
              {name}
              {dynamicAge ? (
                <span className="font-normal text-navy/60">, {dynamicAge}</span>
              ) : null}
            </h2>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
              {child.country && <MetaItem icon={MapPin}>{child.country}</MetaItem>}
              {timeAtRolf && <MetaItem icon={Home}>{timeAtRolf}</MetaItem>}
            </div>
          </div>
          {lastUpdated && (
            <p className="text-xs font-medium text-navy/45 sm:text-right">
              Updated {lastUpdated}
            </p>
          )}
        </div>

        {(child.country || joined || child.favorite_subject || child.id_rolf) && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            {child.country && (
              <ProfileFact icon={MapPin} label="Location" value={child.country} />
            )}
            {joined && (
              <ProfileFact icon={CalendarDays} label="Joined" value={joined} />
            )}
            {child.favorite_subject && (
              <ProfileFact
                icon={BookOpen}
                label="Subject"
                value={child.favorite_subject}
              />
            )}
            {child.id_rolf && (
              <ProfileFact icon={Heart} label="ROLF ID" value={child.id_rolf} />
            )}
          </dl>
        )}

        {child.bio && (
          <div className="space-y-1">
            <SectionLabel>About {firstName}</SectionLabel>
            <p className="line-clamp-4 text-sm leading-6 text-navy/75">
              {child.bio}
            </p>
          </div>
        )}

        {(child.career_aspiration || hobbies.length > 0) && (
          <div className="grid gap-4 border-t border-stone pt-4 sm:grid-cols-2">
            {child.career_aspiration && (
              <div className="space-y-1 border-l-2 border-teal pl-3">
                <SectionLabel>Hope for the future</SectionLabel>
                <p className="text-sm font-medium leading-6 text-navy">
                  {child.career_aspiration}
                </p>
              </div>
            )}
            {hobbies.length > 0 && (
              <div className="space-y-2">
                <SectionLabel>Interests</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {hobbies.map((hobby, hobbyIndex) => (
                    <span
                      key={`${hobby}-${hobbyIndex}`}
                      className="inline-flex items-center rounded-md border border-stone bg-ice px-2.5 py-1 text-xs font-medium text-navy/70"
                    >
                      {hobby}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!child.bio && !child.career_aspiration && hobbies.length === 0 && (
          <div className="border-t border-stone pt-4">
            <p className="text-sm leading-6 text-navy/60">
              The ROLF team is still preparing a fuller profile for {firstName}.
            </p>
          </div>
        )}

        {child.profile_video && (
          <div className="space-y-2 border-t border-stone pt-4">
            <SectionLabel>
              <span className="inline-flex items-center gap-1.5">
                <Video className="size-3.5 text-teal" aria-hidden="true" />
                Meet {firstName}
              </span>
            </SectionLabel>
            <div className="overflow-hidden rounded-md border border-stone bg-navy/5">
              <video
                src={child.profile_video}
                controls
                preload="metadata"
                className="w-full [aspect-ratio:16/9]"
              />
            </div>
          </div>
        )}
      </div>
    </article>
  )
}

function DonorCardSkeleton() {
  return (
    <div className="grid overflow-hidden rounded-lg border border-stone bg-white shadow-sm sm:grid-cols-[190px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="min-h-56 animate-pulse bg-stone sm:min-h-full" />
      <div className="space-y-5 p-4 sm:p-5">
        <div className="space-y-2">
          <div className="h-3 w-28 animate-pulse rounded bg-stone" />
          <div className="h-7 w-48 max-w-full animate-pulse rounded bg-stone" />
          <div className="h-4 w-56 max-w-full animate-pulse rounded bg-stone/70" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="h-10 animate-pulse rounded bg-stone/70" />
          <div className="h-10 animate-pulse rounded bg-stone/70" />
          <div className="h-10 animate-pulse rounded bg-stone/70" />
          <div className="h-10 animate-pulse rounded bg-stone/70" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-stone/80" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-stone/80" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-stone/80" />
        </div>
      </div>
    </div>
  )
}

function DonorSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-stone" />
        <div className="h-8 w-72 max-w-full animate-pulse rounded bg-stone" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-stone/80" />
      </div>
      <div className="grid border-y border-stone sm:grid-cols-3">
        <div className="h-16 animate-pulse bg-stone/40" />
        <div className="h-16 animate-pulse border-t border-stone bg-stone/30 sm:border-l sm:border-t-0" />
        <div className="h-16 animate-pulse border-t border-stone bg-stone/20 sm:border-l sm:border-t-0" />
      </div>
      <div className="space-y-4">
        <DonorCardSkeleton />
        <DonorCardSkeleton />
      </div>
    </div>
  )
}

async function DonorChildren() {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('children')
    .select('*')
    .eq('status', 'active')

  const children = (data ?? []) as Child[]
  const count = children.length
  const onlyChildName = count === 1 ? children[0].first_name ?? 'your child' : null
  const countries = Array.from(
    new Set(
      children
        .map((child) => child.country)
        .filter((country): country is string => Boolean(country)),
    ),
  )
  const longestYears = children
    .map((child) => yearsInHome(child))
    .filter((years): years is number => years !== null)
    .sort((a, b) => b - a)[0]

  return (
    <>
      <header className="mb-6 sm:mb-8">
        <p className="text-sm font-medium text-teal">Donor dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight text-navy sm:text-4xl">
          {onlyChildName ? `Meet ${onlyChildName}` : 'Your sponsored children'}
        </h1>
        {count > 0 && (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-navy/60">
            {onlyChildName
              ? `${onlyChildName}'s profile is maintained by the ROLF team so you can see the basics in one place.`
              : `These ${count} profiles are maintained by the ROLF team so donors can see the basics in one place.`}
          </p>
        )}

        {count > 0 && (
          <div className="mt-6 grid border-y border-stone sm:grid-cols-3">
            <SummaryItem
              icon={Heart}
              label="Active profiles"
              value={`${count} child${count === 1 ? '' : 'ren'}`}
            />
            <SummaryItem
              icon={MapPin}
              label="Locations"
              value={
                countries.length === 0
                  ? 'Not listed yet'
                  : `${countries.length} countr${countries.length === 1 ? 'y' : 'ies'}`
              }
            />
            <SummaryItem
              icon={Home}
              label="Longest connection"
              value={yearsLabel(longestYears ?? null) ?? 'Recently joined'}
            />
          </div>
        )}
      </header>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm leading-6 text-destructive">
          We couldn&apos;t load the children right now. Please refresh, or contact the
          ROLF team if this keeps happening.
        </div>
      )}

      {!error && count === 0 && (
        <div className="rounded-lg border border-dashed border-stone bg-white px-6 py-14 text-center shadow-sm motion-safe:duration-200 motion-safe:ease-out motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-sky">
            <Heart className="size-6 text-teal" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-navy">
            No sponsorship profiles are linked yet
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-navy/60">
            We couldn&apos;t find an active child sponsorship linked to your account. If
            this looks wrong, the ROLF team can connect the profile for you.
          </p>
        </div>
      )}

      {count > 0 && (
        <div
          className={
            count === 1
              ? 'mx-auto max-w-3xl space-y-4'
              : 'space-y-4'
          }
        >
          {children.map((child, index) => (
            <ChildCard key={child.id} child={child} index={index} />
          ))}
        </div>
      )}
    </>
  )
}

export function DonorView() {
  return (
    <div className="min-h-[calc(100svh_-_4rem)] bg-ice">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Suspense fallback={<DonorSkeleton />}>
          <DonorChildren />
        </Suspense>
      </main>
    </div>
  )
}
